import type { DmiResponse } from "./providers/dmi";
import type { YrEntry, YrResponse } from "./providers/yr";

/**
 * Synthetic upstream responses, used when WEATHER_MOCK=1.
 *
 * Both providers are public services with rate limits and terms of use, and
 * neither is reachable from every development or CI environment. This produces
 * responses in exactly the upstream wire format — Kelvin and cloud fractions
 * for DMI, Celsius and symbol codes for Yr — so the normalisers, the cache and
 * the whole UI are exercised for real; only the network hop is replaced.
 *
 * The two providers are given slightly different noise so they disagree the
 * way real forecasts do, which is the case the app is built to show.
 */

/** Deterministic PRNG so a given location always mocks the same weather. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Sample = {
  time: Date;
  temperature: number;
  cloudCover: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
};

function generate(
  lat: number,
  lon: number,
  start: Date,
  hours: number,
  offset: number,
): Sample[] {
  const random = mulberry32(
    Math.round(lat * 1000) * 7919 + Math.round(lon * 1000) + offset,
  );
  const baseTemperature = 17 - (lat - 55) * 0.8 + random() * 4;
  const samples: Sample[] = [];

  // A slow-moving weather front, so cloud and rain arrive in runs rather than
  // flickering hour to hour.
  let front = random();
  for (let i = 0; i < hours; i++) {
    const time = new Date(start.getTime() + i * 3_600_000);
    const hourOfDay = time.getUTCHours();
    front = Math.min(1, Math.max(0, front + (random() - 0.5) * 0.14));

    const diurnal = -Math.cos(((hourOfDay - 3) / 24) * 2 * Math.PI) * 4.5;
    const drift = Math.sin((i / hours) * Math.PI * 1.5) * 2.5;
    const temperature =
      baseTemperature + diurnal + drift + (random() - 0.5) * 0.8;

    const cloudCover = Math.min(100, Math.max(0, front * 130 - 12));
    const raining = front > 0.62;
    const precipitation = raining
      ? Math.round((front - 0.6) * 6 * random() * 10) / 10
      : 0;

    samples.push({
      time,
      temperature,
      cloudCover,
      precipitation,
      windSpeed: 2 + front * 9 + random() * 2,
      windDirection: (200 + Math.sin(i / 12) * 90 + random() * 20) % 360,
      humidity: Math.min(99, 55 + front * 40 + (random() - 0.5) * 8),
    });
  }
  return samples;
}

/** Start of the current hour, so mock data always lines up with "now". */
function currentHour(now: Date): Date {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  return start;
}

export function mockDmiResponse(
  lat: number,
  lon: number,
  now = new Date(),
): DmiResponse {
  const samples = generate(lat, lon, currentHour(now), 7 * 24, 0);
  return {
    type: "FeatureCollection",
    features: samples.map((sample) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [lon, lat] as [number, number],
      },
      properties: {
        step: sample.time.toISOString(),
        "temperature-2m": sample.temperature + 273.15,
        "total-precipitation": sample.precipitation,
        "wind-speed-10m": sample.windSpeed,
        "wind-dir-10m": sample.windDirection,
        "fraction-of-cloud-cover": sample.cloudCover / 100,
        "relative-humidity-2m": sample.humidity,
      },
    })),
  };
}

function mockSymbol(sample: Sample, hourOfDay: number): string {
  const suffix = hourOfDay < 5 || hourOfDay >= 21 ? "_night" : "_day";
  if (sample.precipitation >= 2) return "heavyrain";
  if (sample.precipitation >= 0.5) return "rain";
  if (sample.precipitation > 0.05) return "lightrain";
  if (sample.cloudCover > 75) return "cloudy";
  if (sample.cloudCover > 40) return `partlycloudy${suffix}`;
  if (sample.cloudCover > 15) return `fair${suffix}`;
  return `clearsky${suffix}`;
}

export function mockYrResponse(
  lat: number,
  lon: number,
  now = new Date(),
): YrResponse {
  const start = currentHour(now);
  // Offset the seed so Yr disagrees with DMI, as the real providers do.
  const samples = generate(lat, lon, start, 9 * 24, 977);
  const timeseries: YrEntry[] = [];

  for (let i = 0; i < samples.length; i++) {
    // Yr reports hourly for the first two days, then every six hours.
    const coarse = i >= 48;
    if (coarse && i % 6 !== 0) continue;

    const sample = samples[i];
    const symbol = mockSymbol(sample, sample.time.getUTCHours());
    const sixHourTotal = samples
      .slice(i, i + 6)
      .reduce((sum, s) => sum + s.precipitation, 0);

    timeseries.push({
      time: sample.time.toISOString(),
      data: {
        instant: {
          details: {
            air_temperature: Math.round(sample.temperature * 10) / 10,
            cloud_area_fraction: Math.round(sample.cloudCover * 10) / 10,
            relative_humidity: Math.round(sample.humidity * 10) / 10,
            wind_from_direction: Math.round(sample.windDirection * 10) / 10,
            wind_speed: Math.round(sample.windSpeed * 10) / 10,
          },
        },
        ...(coarse
          ? {}
          : {
              next_1_hours: {
                summary: { symbol_code: symbol },
                details: {
                  precipitation_amount:
                    Math.round(sample.precipitation * 10) / 10,
                },
              },
            }),
        next_6_hours: {
          summary: { symbol_code: symbol },
          details: {
            precipitation_amount: Math.round(sixHourTotal * 10) / 10,
          },
        },
      },
    });
  }

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat, 10] },
    properties: {
      meta: { updated_at: start.toISOString() },
      timeseries,
    },
  };
}

export function mockEnabled(): boolean {
  return process.env.WEATHER_MOCK === "1";
}
