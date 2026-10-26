import { TtlCache } from "./cache";
import { foldName, KNOWN_LOCATIONS } from "./locations";
import { mockEnabled } from "./mock";
import {
  buildDmiSearchUrl,
  cleanQuery,
  type DmiSearchResponse,
  normaliseDmiSearch,
  type PlaceSuggestion,
} from "./providers/dmi-search";
import { UpstreamError } from "./service";

/** Enough to scan at a glance on a phone without scrolling. */
const MAX_RESULTS = 8;
/** DMI's index gives up to a few duplicates per place; ask for headroom. */
const UPSTREAM_ROWS = 15;
/** Place names do not change; a day keeps popular prefixes off DMI. */
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 6_000;

const cache = new TtlCache<PlaceSuggestion[]>(1024);

/** The built-in towns, offered before anything is typed. */
function knownSuggestions(): PlaceSuggestion[] {
  return KNOWN_LOCATIONS.map(({ id, name, region }) => ({ id, name, region }));
}

/** Search the built-in towns only: mock mode has no DMI to ask. */
function searchKnown(query: string): PlaceSuggestion[] {
  const folded = foldName(query);
  return knownSuggestions().filter((place) =>
    foldName(place.name).startsWith(folded),
  );
}

/**
 * Places matching what the user has typed so far, best match first. An empty
 * query gets the built-in towns, so the list is never blank on focus.
 */
export async function searchPlaces(raw: string): Promise<PlaceSuggestion[]> {
  const query = cleanQuery(raw);
  if (query.length < 2) return knownSuggestions();
  if (mockEnabled()) return searchKnown(query);

  const cacheKey = query.toLowerCase();
  const cached = cache.fresh(cacheKey);
  if (cached) return cached.value;

  let response: Response;
  try {
    response = await fetch(buildDmiSearchUrl(query, UPSTREAM_ROWS), {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    throw new UpstreamError("kunne ikke kontaktes lige nu.", 502);
  }
  if (!response.ok) {
    throw new UpstreamError(`svarede ${response.status}.`, 502);
  }
  const data = (await response.json().catch(() => null)) as DmiSearchResponse;
  const results = normaliseDmiSearch(data, MAX_RESULTS);
  cache.set(cacheKey, results, SEARCH_TTL_MS);
  return results;
}

/** Exposed for tests. */
export function resetSearchCache(): void {
  cache.clear();
}
