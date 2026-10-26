import { TtlCache } from "./cache";
import {
  DEFAULT_LOCATION,
  findKnownLocation,
  type Location,
  parseLocationId,
  roundCoordinate,
} from "./locations";
import { mockDmiResponse, mockEnabled, mockYrResponse } from "./mock";
import {
  buildDmiUrl,
  type DmiResponse,
  normaliseDmi,
  placeFromDmi,
} from "./providers/dmi";
import {
  buildYrUrl,
  normaliseYr,
  type YrResponse,
  yrUserAgent,
} from "./providers/yr";
import type { ForecastResponse, HourlyForecast, ProviderId } from "./types";

type CachedForecast = { hours: HourlyForecast[]; updatedAt: string };

/** Two providers per place, for a few hundred places' worth of users. */
const cache = new TtlCache<CachedForecast>(512);
/**
 * Places resolved through DMI. A town does not move, so these are kept far
 * longer than a forecast; the size cap is what bounds it.
 */
const places = new TtlCache<Location>(512);
const PLACE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const dmiInFlight = new Map<string, Promise<CachedForecast>>();

/** Both models run hourly, so an hour is as fresh as the data ever gets. */
const DEFAULT_TTL_MS = 60 * 60 * 1000;
/** How long a failed upstream may keep being papered over with stale data. */
const MAX_STALE_MS = 12 * 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 12_000;

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

async function fetchJson<T>(
  url: string,
  init: RequestInit & { headers?: Record<string, string> },
): Promise<{ data: T | null; response: Response }> {
  const response = await fetch(url, {
    ...init,
    // Caching is handled here rather than by Next's fetch cache: the request
    // URL carries a timestamp for DMI, and MET Norway's terms ask for
    // conditional revalidation, neither of which the framework cache does.
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (response.status === 304) return { data: null, response };

  if (response.status === 429) {
    throw new UpstreamError("afviser forespørgsler lige nu (429).", 429);
  }

  if (!response.ok) {
    throw new UpstreamError(`svarede ${response.status}.`, 502);
  }

  return { data: (await response.json()) as T, response };
}

function respond(
  provider: ProviderId,
  location: Location,
  entry: CachedForecast,
  freshness: "live" | "stale",
): ForecastResponse {
  return {
    provider,
    location: { name: location.name, lat: location.lat, lon: location.lon },
    updatedAt: entry.updatedAt,
    freshness,
    hours: entry.hours,
  };
}

/** Cache a freshly loaded forecast and hand it back. */
function store(
  cacheKey: string,
  hours: HourlyForecast[],
  updatedAt = new Date().toISOString(),
  ttlMs = DEFAULT_TTL_MS,
  revalidateToken?: string,
): CachedForecast {
  const entry: CachedForecast = { hours, updatedAt };
  cache.set(cacheKey, entry, ttlMs, revalidateToken);
  return entry;
}

/**
 * Fetch DMI's forecast for a GeoNames id and cache it, along with the place it
 * turned out to be for. Resolving a place and forecasting it are the same
 * upstream call, so whichever happens first saves the other one a trip.
 */
function fetchDmi(id: string): Promise<CachedForecast> {
  // The page, the DMI route and the Yr route can all ask about a new place
  // at once; they share one upstream call.
  let pending = dmiInFlight.get(id);
  if (!pending) {
    pending = fetchDmiUncached(id).finally(() => dmiInFlight.delete(id));
    dmiInFlight.set(id, pending);
  }
  return pending;
}

async function fetchDmiUncached(id: string): Promise<CachedForecast> {
  const { data } = await fetchJson<DmiResponse>(buildDmiUrl(Number(id)), {});
  const response = data as DmiResponse;
  const hours = normaliseDmi(response);
  if (hours.length === 0) {
    throw new UpstreamError("returnerede ingen data for dette sted.", 502);
  }
  const place = placeFromDmi(id, response);
  if (place) places.set(id, place, PLACE_TTL_MS);
  return store(`dmi:${id}`, hours);
}

async function loadDmi(location: Location): Promise<CachedForecast> {
  if (mockEnabled()) {
    return store(
      `dmi:${location.id}`,
      normaliseDmi(mockDmiResponse(location.lat, location.lon)),
    );
  }
  return fetchDmi(location.id);
}

async function loadYr(
  location: Location,
  cacheKey: string,
): Promise<CachedForecast> {
  const lat = roundCoordinate(location.lat);
  const lon = roundCoordinate(location.lon);

  if (mockEnabled()) {
    return store(cacheKey, normaliseYr(mockYrResponse(lat, lon)));
  }

  const previous = cache.peek(cacheKey);
  const headers: Record<string, string> = { "User-Agent": yrUserAgent() };
  // MET Norway asks clients to revalidate rather than re-download.
  if (previous?.revalidateToken) {
    headers["If-Modified-Since"] = previous.revalidateToken;
  }

  const { data, response } = await fetchJson<YrResponse>(buildYrUrl(lat, lon), {
    headers,
  });

  if (response.status === 304 && previous) {
    cache.extend(cacheKey, ttlFromExpires(response));
    return previous.value;
  }

  const parsed = data as YrResponse;
  const hours = normaliseYr(parsed);
  if (hours.length === 0) {
    throw new UpstreamError("returnerede ingen data for dette sted.", 502);
  }

  return store(
    cacheKey,
    hours,
    parsed.properties.meta.updated_at,
    ttlFromExpires(response),
    // Keeping the Last-Modified header lets the next refresh be a conditional
    // request, which is what MET Norway asks clients to do.
    response.headers.get("Last-Modified") ?? undefined,
  );
}

/** Honour the upstream's own Expires header, within sane bounds. */
function ttlFromExpires(response: Response): number {
  const expires = response.headers.get("Expires");
  if (!expires) return DEFAULT_TTL_MS;
  const until = new Date(expires).getTime() - Date.now();
  if (!Number.isFinite(until)) return DEFAULT_TTL_MS;
  return Math.min(Math.max(until, 5 * 60_000), DEFAULT_TTL_MS * 3);
}

/**
 * Fetch a provider's forecast for a location, with a fresh-then-stale cache.
 *
 * A provider that is down should degrade to yesterday's numbers with a visible
 * "stale" marker, not to an error page — the app's whole point is showing two
 * forecasts, and one of them being briefly out of date is far better than
 * losing the comparison.
 */
export async function getForecast(
  provider: ProviderId,
  locationId: string | null,
): Promise<ForecastResponse> {
  const location = await resolveLocation(locationId);
  const cacheKey = `${provider}:${location.id}`;

  const fresh = cache.fresh(cacheKey);
  if (fresh) return respond(provider, location, fresh.value, "live");

  try {
    const loaded =
      provider === "dmi"
        ? await loadDmi(location)
        : await loadYr(location, cacheKey);
    return respond(provider, location, loaded, "live");
  } catch (error) {
    const stale = cache.peek(cacheKey);
    if (stale && Date.now() - stale.storedAt < MAX_STALE_MS) {
      return respond(provider, location, stale.value, "stale");
    }
    throw error;
  }
}

/**
 * The place a `sted` value names: one of the built-in towns, one DMI has
 * already told us about, or one looked up by asking DMI for its forecast,
 * whose response carries the coordinates Yr needs.
 *
 * Anything unparseable falls back to the default town. A place that cannot be
 * resolved right now (DMI down, or an id it does not know) is an
 * `UpstreamError`, so a bad link says so rather than quietly showing
 * Copenhagen.
 */
export async function resolveLocation(
  value: string | null | undefined,
): Promise<Location> {
  const id = parseLocationId(value);
  if (!id) return DEFAULT_LOCATION;

  const known = findKnownLocation(id);
  if (known) return known;

  const cached = places.peek(id);
  if (cached) return cached.value;

  // Mock mode only knows the built-in towns: there is no DMI to ask.
  if (mockEnabled()) return DEFAULT_LOCATION;

  await fetchDmi(id);
  const resolved = places.peek(id)?.value;
  if (!resolved) {
    throw new UpstreamError("kender ikke dette sted.", 404);
  }
  return resolved;
}

/** Exposed for tests. */
export function resetForecastCache(): void {
  cache.clear();
  places.clear();
}
