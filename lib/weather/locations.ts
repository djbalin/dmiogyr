export type Location = {
  /**
   * DMI's GeoNames id for the place, as a string, e.g. the `2614481` in
   * `dmi.dk/lokation/show/DK/2614481/Roskilde/`. DMI's own site (and the
   * `ninjo2dmidk`/`dmidk_byvejrWS` endpoints it calls) is keyed by this id
   * rather than by coordinates, so it doubles as the id in the URL and in
   * localStorage.
   */
  id: string;
  name: string;
  /** Municipality or region shown under the name, to disambiguate. */
  region?: string;
  lat: number;
  lon: number;
};

/**
 * Places that are always known without asking DMI: the default, the towns
 * offered before anything is typed in the search box, and the places mock
 * mode can serve. Everything else is resolved through DMI on demand (see
 * `resolveLocation`).
 *
 * `slug` keeps links and stored choices from before search existed working.
 */
export const KNOWN_LOCATIONS: (Location & { slug: string })[] = [
  {
    id: "2618425",
    slug: "koebenhavn",
    name: "København",
    region: "Hovedstaden",
    lat: 55.6761,
    lon: 12.5683,
  },
  {
    id: "2624652",
    slug: "aarhus",
    name: "Aarhus",
    region: "Midtjylland",
    lat: 56.1629,
    lon: 10.2039,
  },
  {
    id: "2615876",
    slug: "odense",
    name: "Odense",
    region: "Syddanmark",
    lat: 55.4038,
    lon: 10.4024,
  },
  {
    id: "2624886",
    slug: "aalborg",
    name: "Aalborg",
    region: "Nordjylland",
    lat: 57.0488,
    lon: 9.9217,
  },
  {
    id: "2622447",
    slug: "esbjerg",
    name: "Esbjerg",
    region: "Syddanmark",
    lat: 55.4765,
    lon: 8.4594,
  },
  {
    id: "2614481",
    slug: "roskilde",
    name: "Roskilde",
    region: "Sjælland",
    lat: 55.6415,
    lon: 12.0803,
  },
  {
    id: "2620473",
    slug: "helsingoer",
    name: "Helsingør",
    region: "Hovedstaden",
    lat: 56.0361,
    lon: 12.6136,
  },
  {
    id: "2610613",
    slug: "vejle",
    name: "Vejle",
    region: "Syddanmark",
    lat: 55.7093,
    lon: 9.5358,
  },
  {
    id: "2614553",
    slug: "roenne",
    name: "Rønne",
    region: "Bornholm",
    lat: 55.0999,
    lon: 14.7009,
  },
  {
    id: "2613939",
    slug: "skagen",
    name: "Skagen",
    region: "Nordjylland",
    lat: 57.7211,
    lon: 10.5839,
  },
];

export const DEFAULT_LOCATION: Location = toLocation(KNOWN_LOCATIONS[0]);

function toLocation({ slug: _slug, ...location }: Location & { slug: string }) {
  return location;
}

/**
 * The GeoNames id a `sted` URL parameter points at: a bare id, or one of the
 * old slugs. Null for anything else.
 */
export function parseLocationId(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{1,10}$/.test(trimmed)) return trimmed;
  return KNOWN_LOCATIONS.find((known) => known.slug === trimmed)?.id ?? null;
}

/** A place from the built-in list, by GeoNames id or old slug. */
export function findKnownLocation(
  value: string | null | undefined,
): Location | null {
  const id = parseLocationId(value);
  const known = KNOWN_LOCATIONS.find((location) => location.id === id);
  return known ? toLocation(known) : null;
}

/**
 * Upstream APIs are cached per coordinate pair, and both providers ask for no
 * more than four decimals, so round before building a request URL.
 */
export function roundCoordinate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Great-circle distance in kilometres. */
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * A name folded for matching what someone typed on a keyboard without Danish
 * letters: case- and accent-insensitive, with "aa", "oe" and "ae" standing in
 * for å, ø and æ.
 */
export function foldName(value: string): string {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/aa/g, "a")
    .replace(/oe/g, "o")
    .trim();
}
