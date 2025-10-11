import type { DMIAPIResponse } from "@/app/api/dmi/types";

export interface HourlyForecast {
  timestamp: string;
  hour: string;
  dayName: string;
  temperature: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  humidity: number;
  // pressure: number;
  // gustSpeed: number;
  // visibility: number;
}

export function processHourlyForecasts(data: DMIAPIResponse): HourlyForecast[] {
  if (!data.features || data.features.length === 0) {
    return [];
  }

  return data.features.map((feature) => {
    const timestamp = new Date(feature.properties.step);

    return {
      timestamp: timestamp.toISOString(),
      hour: timestamp.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      dayName: timestamp.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      temperature: feature.properties["temperature-2m"] - 273.15, // Convert Kelvin to Celsius
      precipitation: feature.properties["total-precipitation"],
      windSpeed: feature.properties["wind-speed-10m"],
      windDirection: feature.properties["wind-dir-10m"],
      cloudCover: feature.properties["fraction-of-cloud-cover"] * 100, // convert from fraction to percentage
      humidity: feature.properties["relative-humidity-2m"],
      // pressure: feature.properties["pressure-sealevel"],
      // gustSpeed: feature.properties["gust-wind-speed-10m"],
      // visibility: feature.properties.visibility,
    };
  });
}

export function getWeatherEmoji(
  cloudCover: number,
  precipitation: number,
  isNight: boolean = false,
): string {
  if (precipitation > 2) return "🌧️";
  if (cloudCover > 75) return "☁️";
  if (cloudCover > 40) return isNight ? "🌑" : "⛅";
  return isNight ? "🌑" : "☀️";
}
