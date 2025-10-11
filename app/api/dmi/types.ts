export const DMI_WEATHER_METRICS = [
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

type DMIPropertySlug = (typeof DMI_WEATHER_METRICS)[number];

type DMIProperty = {
  [key in DMIPropertySlug]: number;
} & {
  step: string;
};

type DMIFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: DMIProperty;
};

export type DMIAPIResponse = {
  type: "FeatureCollection";
  features: Array<DMIFeature>;
};
