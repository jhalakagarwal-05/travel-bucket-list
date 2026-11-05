import { useEffect, useState } from "react";
import "./share.css";

type DestinationStatus = "dream" | "planned" | "visited";
type SharedDestination = {
  id: number;
  name: string;
  country: string;
  categoryName: string | null;
  status: DestinationStatus;
  priority: number;
  estimatedCost: string | null;
  visitedDate: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string | null;
};
type PublicShareProps = {
  token: string;
  navigate: (path: string) => void;
};
type LoadState = "loading" | "ready" | "not-found" | "error";

function ShareMark() {
  return <span className="public-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 18.4 9.3 6l3 7.1 1.8-4.3 4.9 9.6M4.5 19.2h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9.3" cy="5.2" r="1.5" fill="currentColor" /></svg></span>;
}

function SharedCard({ item, index }: { item: SharedDestination; index: number }) {
  const visitedDate = item.visitedDate ? new Date(`${item.visitedDate.slice(0, 10)}T00:00:00`) : null;
  const validDate = visitedDate && !Number.isNaN(visitedDate.getTime()) ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(visitedDate) : null;
  return (
    <article className="public-destination-card" style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}>
      <div className={`public-card-art public-art-${item.status}`} aria-hidden="true">
        <span className="public-art-sun" />
        <span className="public-art-contour contour-one" />
        <span className="public-art-contour contour-two" />
        <span className="public-art-coordinate">{item.latitude !== null && item.longitude !== null ? `${item.latitude.toFixed(2)}° / ${item.longitude.toFixed(2)}°` : `JOURNAL ENTRY  ${String(index + 1).padStart(2, "0")}`}</span>
        <span className="public-art-pin"><svg viewBox="0 0 24 24" fill="none"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg></span>
      </div>
      <div className="public-card-body">
        <div className="public-card-title-row">
          <div><p className="public-card-index">PLACE {String(index + 1).padStart(2, "0")}</p><h2>{item.name}</h2></div>
          <span className={`public-status status-${item.status}`}><i />{item.status}</span>
        </div>
        <p className="public-card-country"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>{item.country}</p>
        <div className="public-card-meta">
          <span>{item.categoryName || "A place to remember"}</span>
          {validDate && <span>Visited {validDate}</span>}
          {item.estimatedCost && <span>Estimated {item.estimatedCost}</span>}
        </div>
        {item.notes && <div className="public-card-notes"><span className="public-notes-label">A note to remember</span><p>{item.notes}</p></div>}
      </div>
    </article>
  );
}

function LoadingView() {
  return (
    <main className="public-share-page" aria-label="Loading shared Wanderlist" aria-busy="true">
      <header className="public-share-header"><div className="public-share-header-inner"><span className="public-brand"><ShareMark />wanderlist</span><span className="public-readonly-badge">Read-only journal</span></div></header>
      <div className="public-share-main">
        <section className="public-share-hero"><span className="public-skeleton eyebrow-skeleton" /><span className="public-skeleton title-skeleton" /><span className="public-skeleton copy-skeleton" /></section>
        <div className="public-share-grid">{[0, 1, 2].map((i) => <div className="public-card-skeleton" key={i}><span /><div><i /><i /><i /></div></div>)}</div>
      </div>
    </main>
  );
}

export default function PublicShare({ token, navigate: _navigate }: PublicShareProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [destinations, setDestinations] = useState<SharedDestination[]>([]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setState("loading");
    fetch(`/api/public/share/${encodeURIComponent(token)}`, { credentials: "omit" })
      .then(async (response) => {
        if (response.status === 404) {
          if (active) setState("not-found");
          return;
        }
        if (!response.ok) throw new Error("We couldn’t load this shared journal.");
        const result = await response.json() as { destinations: SharedDestination[] };
        if (active) {
          setDestinations(Array.isArray(result.destinations) ? result.destinations : []);
          setState("ready");
        }
      })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [token, retry]);

  if (state === "loading") return <LoadingView />;
  if (state === "not-found") {
    return (
      <main className="public-share-page public-share-empty-state">
        <header className="public-share-header"><div className="public-share-header-inner"><span className="public-brand"><ShareMark />wanderlist</span><span className="public-readonly-badge">Read-only journal</span></div></header>
        <section className="public-status-message" role="status">
          <span className="public-message-art" aria-hidden="true"><ShareMark /></span>
          <p className="public-share-kicker">The road ends here</p>
          <h1>This link isn’t available.</h1>
          <p>It may have been turned off, or the address may have changed. Ask the person who shared it for a current link.</p>
        </section>
      </main>
    );
  }
  if (state === "error") {
    return (
      <main className="public-share-page public-share-empty-state">
        <header className="public-share-header"><div className="public-share-header-inner"><span className="public-brand"><ShareMark />wanderlist</span><span className="public-readonly-badge">Read-only journal</span></div></header>
        <section className="public-status-message" role="alert">
          <span className="public-message-art" aria-hidden="true"><ShareMark /></span>
          <p className="public-share-kicker">A small detour</p>
          <h1>We couldn’t load this journal.</h1>
          <p>Check your connection, then give the link another try.</p>
          <button type="button" className="share-primary-button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
        </section>
      </main>
    );
  }

  const visitedCount = destinations.filter((item) => item.status === "visited").length;
  const plannedCount = destinations.filter((item) => item.status === "planned").length;
  return (
    <main className="public-share-page">
      <header className="public-share-header">
        <div className="public-share-header-inner">
          <span className="public-brand"><ShareMark />wanderlist</span>
          <span className="public-readonly-badge"><span />Shared journal · read only</span>
        </div>
      </header>
      <div className="public-share-main">
        <section className="public-share-hero">
          <div className="public-hero-copy">
            <p className="public-share-kicker"><span />A personal travel journal</p>
            <h1>A little collection<br />of <em>everywhere.</em></h1>
            <p className="public-share-intro">Places already tucked into memory, and places still calling from the map.</p>
          </div>
          <aside className="public-travel-stamp" aria-label={`${destinations.length} places, ${visitedCount} visited, ${plannedCount} planned`}>
            <span className="stamp-topline">SOMEWHERE IN BETWEEN</span>
            <strong>{String(destinations.length).padStart(2, "0")}</strong>
            <span className="stamp-caption">{destinations.length === 1 ? "place collected" : "places collected"}</span>
            <span className="stamp-rule" />
            <span className="stamp-stats"><b>{visitedCount}</b> visited <i /> <b>{plannedCount}</b> planned</span>
          </aside>
          <div className="public-hero-map" aria-hidden="true"><span className="map-contour map-contour-a" /><span className="map-contour map-contour-b" /><span className="map-contour map-contour-c" /><span className="map-route-line" /><span className="map-point point-one" /><span className="map-point point-two" /><span className="map-point point-three" /></div>
        </section>

        {destinations.length ? (
          <>
            <div className="public-list-heading"><div><p className="public-share-kicker">The places</p><h2>Collected along the way<span>.</span></h2></div><span className="public-count">{destinations.length} {destinations.length === 1 ? "entry" : "entries"}</span></div>
            <section className="public-share-grid" aria-label="Shared destinations">
              {destinations.map((item, index) => <SharedCard key={item.id} item={item} index={index} />)}
            </section>
          </>
        ) : (
          <section className="public-empty-card">
            <span className="public-empty-orbit" aria-hidden="true"><ShareMark /></span>
            <p className="public-share-kicker">A blank page, for now</p>
            <h2>No places have been added yet.</h2>
            <p>This journal is ready for its first destination.</p>
          </section>
        )}
        <footer className="public-share-footer"><span className="footer-rule" /><span>Wanderlist · a journal for the road ahead</span><span className="footer-rule" /></footer>
      </div>
    </main>
  );
}
