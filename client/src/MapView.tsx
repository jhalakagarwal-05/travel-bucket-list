import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';

type Destination = {
  id: number | string;
  name: string;
  country?: string | null;
  status?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type MapViewProps = {
  navigate: (path: string) => void;
  onUnauthorized: () => void;
};

type MapPayload = { destinations: Destination[] };
type MapConfig = { tileUrl?: string };

const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function coordinatesFor(destination: Destination): [number, number] | null {
  const latitude = Number(destination.latitude);
  const longitude = Number(destination.longitude);
  if (
    destination.latitude === null || destination.latitude === undefined || destination.latitude === '' ||
    destination.longitude === null || destination.longitude === undefined || destination.longitude === '' ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return null;
  return [latitude, longitude];
}

function statusName(status: string | null | undefined) {
  if (status === 'visited') return 'Visited';
  if (status === 'planned') return 'Planned';
  return 'Dream';
}

function markerIcon(status: string | null | undefined) {
  const tone = status === 'visited' ? 'visited' : status === 'planned' ? 'planned' : 'dream';
  return L.divIcon({
    className: 'wander-map-marker-shell',
    html: `<span class="wander-map-marker wander-map-marker--${tone}"><span></span></span>`,
    iconSize: [32, 40],
    iconAnchor: [16, 36],
    popupAnchor: [0, -32],
  });
}

function makePopup(destination: Destination, navigate: (path: string) => void) {
  const wrap = document.createElement('div');
  wrap.className = 'wander-map-popup';
  const status = document.createElement('span');
  status.className = `wander-map-popup-status wander-map-popup-status--${destination.status === 'visited' ? 'visited' : destination.status === 'planned' ? 'planned' : 'dream'}`;
  status.textContent = statusName(destination.status);
  const title = document.createElement('strong');
  title.textContent = destination.name;
  const place = document.createElement('span');
  place.className = 'wander-map-popup-place';
  place.textContent = destination.country || 'Saved destination';
  const link = document.createElement('a');
  link.href = `/destinations/${encodeURIComponent(String(destination.id))}`;
  link.className = 'wander-map-popup-link';
  link.textContent = 'Open travel note';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    navigate(link.href.replace(window.location.origin, ''));
  });
  wrap.append(status, title, place, link);
  return wrap;
}

export default function MapView({ navigate, onUnauthorized }: MapViewProps) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [tileUrl, setTileUrl] = useState(DEFAULT_TILE_URL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const unauthorizedRef = useRef(onUnauthorized);
  const navigateRef = useRef(navigate);
  unauthorizedRef.current = onUnauthorized;
  navigateRef.current = navigate;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    Promise.all([
      fetch('/api/destinations', { credentials: 'include', signal: controller.signal }),
      fetch('/api/map/config', { credentials: 'include', signal: controller.signal }),
    ])
      .then(async ([destinationsResponse, configResponse]) => {
        if (destinationsResponse.status === 401 || configResponse.status === 401) {
          unauthorizedRef.current();
          return null;
        }
        if (!destinationsResponse.ok || !configResponse.ok) throw new Error('Map request failed');
        const payload = await destinationsResponse.json() as MapPayload;
        const config = await configResponse.json() as MapConfig;
        if (!payload || !Array.isArray(payload.destinations)) throw new Error('Invalid destinations response');
        return { destinations: payload.destinations, tileUrl: config?.tileUrl || DEFAULT_TILE_URL };
      })
      .then((result) => {
        if (result && !controller.signal.aborted) {
          setDestinations(result.destinations);
          setTileUrl(result.tileUrl);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setDestinations([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (loading || error || !mapElementRef.current) return;
    const map = L.map(mapElementRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
    });
    mapRef.current = map;
    L.tileLayer(tileUrl, {
      attribution: '',
      updateWhenIdle: true,
      keepBuffer: 0,
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const pins: Marker[] = [];
    destinations.forEach((destination) => {
      const coordinates = coordinatesFor(destination);
      if (!coordinates) return;
      const marker = L.marker(coordinates, {
        icon: markerIcon(destination.status),
        title: `${destination.name}, ${statusName(destination.status)}`,
        keyboard: true,
      }).addTo(map);
      marker.bindPopup(makePopup(destination, (path) => navigateRef.current(path)), { closeButton: true, minWidth: 170 });
      pins.push(marker);
    });
    if (pins.length === 1) {
      map.setView(pins[0].getLatLng(), 5);
    } else if (pins.length > 1) {
      map.fitBounds(L.featureGroup(pins).getBounds(), { padding: [44, 44], maxZoom: 7 });
    }
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [destinations, error, loading, tileUrl]);

  const mappedCount = destinations.filter((destination) => coordinatesFor(destination)).length;
  const unmappedDestinations = destinations.filter((destination) => !coordinatesFor(destination));
  const missingCount = unmappedDestinations.length;

  if (loading) {
    return (
      <main className="map-main" aria-label="Loading your map" aria-busy="true">
        <div className="map-heading-skeleton" />
        <div className="map-panel-skeleton" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="map-main">
        <section className="map-message-card map-error" role="alert">
          <span className="map-kicker">A small detour</span>
          <h1>Your map is taking a moment.</h1>
          <p>We couldn’t load your destinations just now. Your travel notes are safe; try again in a moment.</p>
          <button type="button" className="map-retry" onClick={() => setAttempt((current) => current + 1)}>Try again</button>
        </section>
      </main>
    );
  }

  return (
    <main className="map-main">
      <header className="map-heading">
        <div>
          <span className="map-kicker">Your travel journal</span>
          <h1>Everywhere, in one view.</h1>
          <p>A little geography for all the places you’ve been, and those still calling.</p>
        </div>
        <div className="map-count" aria-live="polite">
          <span className="map-count-number">{mappedCount}</span>
          <span>{mappedCount === 1 ? 'place on the map' : 'places on the map'}</span>
        </div>
      </header>

      {destinations.length === 0 ? (
        <section className="map-notice map-empty-notice">
          <span className="map-notice-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="20" r="11" stroke="currentColor" strokeWidth="1.5"/><path d="M24 42s14-13.2 14-22a14 14 0 1 0-28 0c0 8.8 14 22 14 22Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="24" cy="20" r="3" fill="currentColor"/></svg>
          </span>
          <div>
            <h2>Your map is ready for its first pin.</h2>
            <p>Add a place to My List and it will find its way here.</p>
          </div>
          <a className="map-inline-link" href="/my-list" onClick={(event) => { event.preventDefault(); navigate('/my-list'); }}>Go to My List <span aria-hidden="true">→</span></a>
        </section>
      ) : missingCount > 0 ? (
        <section className="map-notice map-coordinate-notice" role="status">
          <span className="map-notice-mark map-notice-mark--small" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M12 22s8-7.5 8-12a8 8 0 1 0-16 0c0 4.5 8 12 8 12Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="10" r="1.8" fill="currentColor"/></svg>
          </span>
          <p><strong>{missingCount} {missingCount === 1 ? 'destination has' : 'destinations have'} no coordinates yet.</strong> Only geocoded entries appear here. Use <em>Find location</em> on the destination form to add coordinates.</p>
          <a className="map-inline-link" href="/my-list" onClick={(event) => { event.preventDefault(); navigate('/my-list'); }}>My List <span aria-hidden="true">→</span></a>
        </section>
      ) : null}

      {unmappedDestinations.length > 0 && (
        <section className="map-unmapped-section" aria-labelledby="map-unmapped-heading">
          <div className="map-unmapped-heading">
            <div>
              <span className="map-kicker">Ready to add</span>
              <h2 id="map-unmapped-heading">Places not on the map yet</h2>
              <p>Add or find a location to give each place its map pin.</p>
            </div>
            <span className="map-unmapped-count">{unmappedDestinations.length}</span>
          </div>
          <ul className="map-unmapped-list">
            {unmappedDestinations.map((destination) => {
              const editPath = `/destinations/${encodeURIComponent(String(destination.id))}/edit`;
              return (
                <li className="map-unmapped-item" key={destination.id}>
                  <div>
                    <strong>{destination.name}</strong>
                    <span>{destination.country || 'Country not specified'}</span>
                  </div>
                  <a
                    className="map-unmapped-edit"
                    href={editPath}
                    onClick={(event) => { event.preventDefault(); navigate(editPath); }}
                  >
                    Add location <span aria-hidden="true">→</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="map-frame" aria-label="Map of your destinations">
        <div ref={mapElementRef} className="wander-map-canvas" role="application" aria-label="Interactive map with your destinations" />
        <div className="map-legend" aria-label="Destination status legend">
          <span><i className="legend-dot legend-dot--dream" />Dream</span>
          <span><i className="legend-dot legend-dot--planned" />Planned</span>
          <span><i className="legend-dot legend-dot--visited" />Visited</span>
        </div>
        <div className="map-attribution">
          Map tiles by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
        </div>
      </section>
      <p className="map-footnote">{mappedCount === 0 ? 'Your map is centered on the world, ready when you are.' : `Showing ${mappedCount} ${mappedCount === 1 ? 'geocoded destination' : 'geocoded destinations'} from your private list.`}</p>
    </main>
  );
}
