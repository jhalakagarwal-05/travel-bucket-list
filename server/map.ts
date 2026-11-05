import { Router } from "express";
import { requireUser } from "./auth.js";

type LocationResult = { latitude: number; longitude: number; label: string; country: string };
type CachedResults = { expiresAt: number; results: LocationResult[] };

const cache = new Map<string, CachedResults>();
const pending = new Map<string, Promise<LocationResult[]>>();
const cacheTtl = 30 * 24 * 60 * 60 * 1000;
const maxCacheEntries = 500;
const minimumRequestInterval = 1000;
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

const tileDefault = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const nominatimDefault = "https://nominatim.openstreetmap.org";

export const mapRouter = Router();
mapRouter.use(requireUser);

mapRouter.get("/config", (_request, response) => {
  response.json({
    tileUrl: process.env.OSM_TILE_URL?.trim() || tileDefault,
  });
});

function queueRequest<T>(operation: () => Promise<T>): Promise<T> {
  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>((resolve) => { release = resolve; });
  return previous.then(async () => {
    try {
      const delay = Math.max(0, nextRequestAt - Date.now());
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      nextRequestAt = Date.now() + minimumRequestInterval;
      return await operation();
    } finally {
      release();
    }
  });
}

async function searchNominatim(name: string, country: string): Promise<LocationResult[]> {
  const baseUrl = process.env.NOMINATIM_BASE_URL?.trim() || nominatimDefault;
  const queryKey = `${baseUrl.toLowerCase()}|${name.toLocaleLowerCase()}|${country.toLocaleLowerCase()}`;
  const cached = cache.get(queryKey);
  if (cached && cached.expiresAt > Date.now()) {
    cache.delete(queryKey);
    cache.set(queryKey, cached);
    return cached.results;
  }
  if (cached) cache.delete(queryKey);
  const inFlight = pending.get(queryKey);
  if (inFlight) return inFlight;

  const lookup = queueRequest(async () => {
    const url = new URL("/search", baseUrl);
    url.searchParams.set("q", country ? `${name}, ${country}` : name);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Wanderlist/1.0 (personal travel journal; user-triggered location search)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Nominatim returned HTTP ${response.status}.`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Nominatim returned an invalid result.");
    return data.flatMap((item: unknown): LocationResult[] => {
      if (typeof item !== "object" || item === null) return [];
      const result = item as {
        lat?: unknown;
        lon?: unknown;
        display_name?: unknown;
        address?: { country?: unknown };
      };
      const latitude = Number(result.lat);
      const longitude = Number(result.lon);
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
          !Number.isFinite(longitude) || Math.abs(longitude) > 180) return [];
      return [{
        latitude,
        longitude,
        label: typeof result.display_name === "string" ? result.display_name : `${name}${country ? `, ${country}` : ""}`,
        country: typeof result.address?.country === "string" ? result.address.country : country,
      }];
    });
  });
  pending.set(queryKey, lookup);
  try {
    const results = await lookup;
    if (cache.size >= maxCacheEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(queryKey, { expiresAt: Date.now() + cacheTtl, results });
    return results;
  } finally {
    pending.delete(queryKey);
  }
}

mapRouter.get("/geocode", async (request, response, next) => {
  const name = typeof request.query.name === "string" ? request.query.name.trim().replace(/\s+/g, " ") : "";
  const country = typeof request.query.country === "string" ? request.query.country.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 150 || country.length > 100) {
    response.status(400).json({ error: "Enter a destination name to find its location." });
    return;
  }
  try {
    response.json({ locations: await searchNominatim(name, country) });
  } catch (error) {
    console.error("Nominatim location lookup failed:", error);
    response.status(502).json({ error: "Location search is temporarily unavailable. You can enter coordinates manually." });
  }
});
