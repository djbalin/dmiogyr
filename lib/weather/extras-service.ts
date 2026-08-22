import { TtlCache } from "./cache";
import { findLocation } from "./locations";
import {
  buildDmiDetailsUrl,
  buildDmiWarningsUrl,
  buildTideUrl,
  type DmiLocationDetails,
  type DmiWarnings,
  normaliseDmiDetails,
  normaliseDmiWarnings,
  normaliseTide,
  type TidePoint,
} from "./providers/dmi-extras";

export type DmiExtras = {
  details: DmiLocationDetails | null;
  warnings: DmiWarnings | null;
  tide: { obs: TidePoint[]; fcst: TidePoint[] } | null;
};

type CachedExtras = { value: DmiExtras; updatedAt: string };

const cache = new TtlCache<CachedExtras>();

/** The text/sun/UV/warnings change at most a few times a day. */
const DETAILS_TTL_MS = 30 * 60 * 1000;
/** Water levels move continuously, so this is refreshed far more often. */
const TIDE_TTL_MS = 10 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 12_000;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * The parts of dmi.dk's location page beyond the hourly forecast, for one
 * town. Each upstream call is allowed to fail independently — a broken
 * warnings feed should not take down the sun-times panel next to it — so a
 * partial result is normal, not an error state.
 */
export async function getDmiExtras(locationId: string | null): Promise<{
  extras: DmiExtras;
  freshness: "live" | "stale";
}> {
  const location = findLocation(locationId);
  const cacheKey = location.id;

  const fresh = cache.fresh(cacheKey);
  if (fresh) return { extras: fresh.value.value, freshness: "live" };

  const [detailsRaw, warningsRaw, tideObsRaw, tideFcstRaw] = await Promise.all([
    fetchJson(buildDmiDetailsUrl(location.dmiGeonameId)),
    fetchJson(buildDmiWarningsUrl(location.dmiGeonameId)),
    location.dmiTideStationId
      ? fetchJson(buildTideUrl(location.dmiTideStationId, "obs"))
      : Promise.resolve(null),
    location.dmiTideStationId
      ? fetchJson(buildTideUrl(location.dmiTideStationId, "fcst"))
      : Promise.resolve(null),
  ]);

  const extras: DmiExtras = {
    details: detailsRaw
      ? normaliseDmiDetails(
          detailsRaw as Parameters<typeof normaliseDmiDetails>[0],
        )
      : null,
    warnings: warningsRaw
      ? normaliseDmiWarnings(
          warningsRaw as Parameters<typeof normaliseDmiWarnings>[0],
        )
      : null,
    tide:
      tideObsRaw || tideFcstRaw
        ? {
            obs: tideObsRaw
              ? normaliseTide(tideObsRaw as Parameters<typeof normaliseTide>[0])
              : [],
            fcst: tideFcstRaw
              ? normaliseTide(
                  tideFcstRaw as Parameters<typeof normaliseTide>[0],
                )
              : [],
          }
        : null,
  };

  const allFailed = !extras.details && !extras.warnings && !extras.tide;
  const previous = cache.peek(cacheKey);

  if (allFailed && previous) {
    return { extras: previous.value.value, freshness: "stale" };
  }

  const updatedAt = new Date().toISOString();
  cache.set(
    cacheKey,
    { value: extras, updatedAt },
    location.dmiTideStationId ? TIDE_TTL_MS : DETAILS_TTL_MS,
  );

  return { extras, freshness: "live" };
}

/** Exposed for tests. */
export function resetExtrasCache(): void {
  cache.clear();
}
