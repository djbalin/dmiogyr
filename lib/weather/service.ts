import { TtlCache } from "./cache";
import { findLocation, type Location, roundCoordinate } from "./locations";
import { mockDmiResponse, mockEnabled, mockYrResponse } from "./mock";
import { buildDmiUrl, type DmiResponse, normaliseDmi } from "./providers/dmi";
import {
  buildYrUrl,
  normaliseYr,
  type YrResponse,
  yrUserAgent,
} from "./providers/yr";
import type { ForecastResponse, HourlyForecast, ProviderId } from "./types";

type CachedForecast = { hours: HourlyForecast[]; updatedAt: string };

const cache = new TtlCache<CachedForecast>();

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

async function loadDmi(
  location: Location,
  cacheKey: string,
): Promise<CachedForecast> {
  if (mockEnabled()) {
    return store(
      cacheKey,
      normaliseDmi(mockDmiResponse(location.lat, location.lon)),
    );
  }

  const url = buildDmiUrl(location.dmiGeonameId);
  const { data } = await fetchJson<DmiResponse>(url, {});
  const hours = normaliseDmi(data as DmiResponse);
  if (hours.length === 0) {
    throw new UpstreamError("returnerede ingen data for dette sted.", 502);
  }
  return store(cacheKey, hours);
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
  const location = findLocation(locationId);
  const cacheKey = `${provider}:${location.id}`;

  const fresh = cache.fresh(cacheKey);
  if (fresh) return respond(provider, location, fresh.value, "live");

  try {
    const loaded =
      provider === "dmi"
        ? await loadDmi(location, cacheKey)
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

/** Exposed for tests. */
export function resetForecastCache(): void {
  cache.clear();
}
