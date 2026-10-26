/**
 * Place search, through the same Solr index dmi.dk's own search box queries.
 *
 * Searching DMI's index rather than a geocoder or a list kept in this repo
 * means every suggestion is a place DMI has a forecast for, keyed by the same
 * GeoNames id its forecast endpoints take, and villages come along for free
 * without anything here to keep up to date.
 *
 * The query mirrors dmi.dk's: an exact name match boosted over a prefix
 * (n-gram) match, both limited to `realm:1` as dmi.dk's own search is, with
 * ties broken by population so a town ranks above a hamlet of the same name.
 */

/** One Solr document. Single-valued fields can still arrive as arrays. */
type SolrValue = string | number | (string | number)[] | null | undefined;

type DmiSearchDoc = {
  id?: SolrValue;
  name?: SolrValue;
  name_ngram?: SolrValue;
  municipality?: SolrValue;
  population?: SolrValue;
};

export type DmiSearchResponse = { response?: { docs?: DmiSearchDoc[] } };

export type PlaceSuggestion = {
  /** GeoNames id, as a string. */
  id: string;
  name: string;
  region?: string;
};

/** Long enough for any Danish place name, short enough to keep queries sane. */
const MAX_QUERY_LENGTH = 64;

/** Trim, collapse whitespace and cap the length of a raw search string. */
export function cleanQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

/** Escape a value for use inside a quoted Solr phrase. */
function phrase(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

export function buildDmiSearchUrl(query: string, rows: number): string {
  const q = phrase(cleanQuery(query));
  const params = new URLSearchParams({
    q: `(name:${q} AND realm:1)^4 OR (name_ngram:${q} AND realm:1)`,
    rows: String(rows),
    sort: "score desc, realm desc, population desc",
    wt: "json",
  });
  return `https://www.dmi.dk/solr/city_core/select?${params}`;
}

function first(value: SolrValue): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  if (single === null || single === undefined) return undefined;
  const text = String(single).trim();
  return text === "" ? undefined : text;
}

export function normaliseDmiSearch(
  data: DmiSearchResponse,
  limit: number,
): PlaceSuggestion[] {
  const seen = new Set<string>();
  const results: PlaceSuggestion[] = [];
  for (const doc of data?.response?.docs ?? []) {
    const id = first(doc.id);
    const name = first(doc.name) ?? first(doc.name_ngram);
    if (!id || !/^\d+$/.test(id) || !name) continue;
    const region = first(doc.municipality);
    // DMI indexes some places more than once (a town and its parish, say);
    // the same name in the same municipality is the same place to a reader.
    const key = `${name}|${region ?? ""}`.toLowerCase();
    if (seen.has(id) || seen.has(key)) continue;
    seen.add(id);
    seen.add(key);
    results.push(region ? { id, name, region } : { id, name });
    if (results.length >= limit) break;
  }
  return results;
}
