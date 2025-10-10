export const WEATHER_METRICS = [
  "temperature-2m",
  "total-precipitation",
  "wind-speed-10m",
  "wind-dir-10m",
  "fraction-of-cloud-cover",
  "relative-humidity-2m",
  "pressure-sealevel",
  "gust-wind-speed-10m",
  "visibility",
] as const;

type PropertySlug = (typeof WEATHER_METRICS)[number];

type Property = {
  [key in PropertySlug]: number;
} & {
  step: number;
};

type Feature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: Property;
};

export type APIResponse = {
  type: "FeatureCollection";
  features: Array<Feature>;
};
