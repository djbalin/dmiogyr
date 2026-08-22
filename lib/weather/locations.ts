export type Location = {
  /** Stable slug used in the URL and in localStorage. */
  id: string;
  name: string;
  /** Region shown under the name in the picker, to disambiguate. */
  region: string;
  lat: number;
  lon: number;
  /**
   * DMI's GeoNames id for this town, e.g. the `2614481` in
   * `dmi.dk/lokation/show/DK/2614481/Roskilde/`. DMI's own site (and the
   * `ninjo2dmidk`/`dmidk_byvejrWS` endpoints it calls) is keyed by this id
   * rather than by coordinates, so it has to be looked up once per town
   * rather than derived from lat/lon.
   */
  dmiGeonameId: number;
  /**
   * Nearest DMI water-level station, from `dmidk_byvejrWS/rest/vandstand/active`.
   * Not every town has one close enough to be meaningful; omitted rather than
   * pointing at a station tens of kilometres away.
   */
  dmiTideStationId?: string;
};

/**
 * A curated list rather than a geocoder.
 *
 * DMI's HARMONIE DINI model only covers the Nordic region, so a free-text
 * search would happily offer places one of the two providers cannot forecast —
 * which is precisely the comparison this app is for. Keeping the list to
 * Danish towns means both providers always have something to say.
 */
export const LOCATIONS: Location[] = [
  {
    id: "koebenhavn",
    name: "København",
    region: "Hovedstaden",
    lat: 55.6761,
    lon: 12.5683,
    dmiGeonameId: 2618425,
    dmiTideStationId: "30336",
  },
  {
    id: "aarhus",
    name: "Aarhus",
    region: "Midtjylland",
    lat: 56.1629,
    lon: 10.2039,
    dmiGeonameId: 2624652,
    dmiTideStationId: "22331",
  },
  {
    id: "odense",
    name: "Odense",
    region: "Syddanmark",
    lat: 55.4038,
    lon: 10.4024,
    dmiGeonameId: 2615876,
    dmiTideStationId: "28086",
  },
  {
    id: "aalborg",
    name: "Aalborg",
    region: "Nordjylland",
    lat: 57.0488,
    lon: 9.9217,
    dmiGeonameId: 2624886,
    dmiTideStationId: "20303",
  },
  {
    id: "esbjerg",
    name: "Esbjerg",
    region: "Syddanmark",
    lat: 55.4765,
    lon: 8.4594,
    dmiGeonameId: 2622447,
    dmiTideStationId: "25149",
  },
  {
    id: "roskilde",
    name: "Roskilde",
    region: "Sjælland",
    lat: 55.6415,
    lon: 12.0803,
    dmiGeonameId: 2614481,
    dmiTideStationId: "30409",
  },
  {
    id: "helsingoer",
    name: "Helsingør",
    region: "Hovedstaden",
    lat: 56.0361,
    lon: 12.6136,
    dmiGeonameId: 2620473,
    // No station at Helsingør itself; Sletten Havn (~12 km south) is the
    // nearest one DMI publishes water levels for.
    dmiTideStationId: "30042",
  },
  {
    id: "vejle",
    name: "Vejle",
    region: "Syddanmark",
    lat: 55.7093,
    lon: 9.5358,
    dmiGeonameId: 2610613,
    dmiTideStationId: "23259",
  },
  {
    id: "roenne",
    name: "Rønne",
    region: "Bornholm",
    lat: 55.0999,
    lon: 14.7009,
    dmiGeonameId: 2614553,
    dmiTideStationId: "32096",
  },
  {
    id: "skagen",
    name: "Skagen",
    region: "Nordjylland",
    lat: 57.7211,
    lon: 10.5839,
    dmiGeonameId: 2613939,
    dmiTideStationId: "20003",
  },
];

export const DEFAULT_LOCATION = LOCATIONS[0];

export function findLocation(id: string | null | undefined): Location {
  if (!id) return DEFAULT_LOCATION;
  return LOCATIONS.find((location) => location.id === id) ?? DEFAULT_LOCATION;
}

/**
 * Upstream APIs are cached per coordinate pair, and both providers ask for no
 * more than four decimals, so round before building a request URL.
 */
export function roundCoordinate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
