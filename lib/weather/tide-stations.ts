import { distanceKm } from "./locations";

type TideStation = { id: string; name: string; lat: number; lon: number };

/**
 * DMI water-level stations, from `dmidk_byvejrWS/rest/vandstand/active`.
 * Positions are those of the harbours, to the nearest kilometre or so: plenty
 * for picking the nearest one within `MAX_DISTANCE_KM`.
 */
export const TIDE_STATIONS: TideStation[] = [
  { id: "30336", name: "København", lat: 55.705, lon: 12.6 },
  { id: "22331", name: "Aarhus", lat: 56.15, lon: 10.22 },
  { id: "28086", name: "Odense", lat: 55.415, lon: 10.385 },
  { id: "20303", name: "Aalborg", lat: 57.055, lon: 9.92 },
  { id: "25149", name: "Esbjerg", lat: 55.465, lon: 8.44 },
  { id: "30409", name: "Roskilde", lat: 55.65, lon: 12.075 },
  { id: "30042", name: "Sletten Havn", lat: 55.95, lon: 12.535 },
  { id: "23259", name: "Vejle", lat: 55.705, lon: 9.56 },
  { id: "32096", name: "Rønne", lat: 55.095, lon: 14.69 },
  { id: "20003", name: "Skagen", lat: 57.715, lon: 10.59 },
];

/**
 * Further than this and a station's water level says little about the place
 * the user asked for, so none is shown rather than a misleading one.
 */
const MAX_DISTANCE_KM = 15;

/** The nearest station within reach, or null for an inland place. */
export function nearestTideStation(point: {
  lat: number;
  lon: number;
}): TideStation | null {
  let best: TideStation | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const station of TIDE_STATIONS) {
    const distance = distanceKm(point, station);
    if (distance < bestDistance) {
      best = station;
      bestDistance = distance;
    }
  }
  return bestDistance <= MAX_DISTANCE_KM ? best : null;
}
