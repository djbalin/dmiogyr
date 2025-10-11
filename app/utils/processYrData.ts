import { type YrAPIResponse, type YrTimeseries } from "@/app/api/yr/types";
import { type HourlyForecast } from "./processData";

/**
 * Process Yr (MET Norway) API response into standardized HourlyForecast format
 * Based on Locationforecast 2.0 compact format
 */
export function processYrForecasts(data: YrAPIResponse): HourlyForecast[] {
  if (!data.properties?.timeseries || data.properties.timeseries.length === 0) {
    return [];
  }

  return data.properties.timeseries.map((timeseries: YrTimeseries) => {
    const timestamp = new Date(timeseries.time);
    const instant = timeseries.data.instant.details;

    // Get precipitation from next_1_hours, fallback to next_6_hours
    const precipitation =
      timeseries.data.next_1_hours?.details.precipitation_amount ??
      timeseries.data.next_6_hours?.details.precipitation_amount ??
      0;

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
      // Yr already provides temperature in Celsius
      temperature: instant.air_temperature ?? 0,
      precipitation: precipitation,
      windSpeed: instant.wind_speed ?? 0,
      windDirection: instant.wind_from_direction ?? 0,
      // Yr provides cloud cover as percentage (0-100), same as our format
      cloudCover: instant.cloud_area_fraction ?? 0,
      humidity: instant.relative_humidity ?? 0,
      pressure: instant.air_pressure_at_sea_level ?? 0,
      gustSpeed: instant.wind_speed_of_gust ?? 0,
      // Yr doesn't provide visibility in compact format, default to 0
      visibility: 0,
    };
  });
}

/**
 * Get weather symbol code from Yr data for a specific time
 * Symbol codes follow the format: "clearsky_day", "partlycloudy_night", etc.
 */
export function getYrSymbolCode(timeseries: YrTimeseries): string {
  return (
    timeseries.data.next_1_hours?.summary.symbol_code ??
    timeseries.data.next_6_hours?.summary.symbol_code ??
    timeseries.data.next_12_hours?.summary.symbol_code ??
    "clearsky_day"
  );
}

/**
 * Map Yr symbol codes to simple emoji (similar to DMI logic)
 * For more sophisticated icons, use Yr's official weather icons from:
 * https://github.com/metno/weathericons
 */
export function getWeatherEmojiFromYrSymbol(symbolCode: string): string {
  // Remove time-of-day suffix (_day, _night, _polartwilight)
  const baseSymbol = symbolCode.split("_")[0];

  // Map common Yr symbols to emojis
  const symbolMap: Record<string, string> = {
    clearsky: "☀️",
    fair: "🌤️",
    partlycloudy: "⛅",
    cloudy: "☁️",
    rainshowers: "🌦️",
    rain: "🌧️",
    heavyrain: "🌧️",
    sleet: "🌨️",
    snow: "❄️",
    snowshowers: "🌨️",
    fog: "🌫️",
    lightrainshowers: "🌦️",
    heavyrainshowers: "🌧️",
    lightsleetshowers: "🌨️",
    heavysleetshowers: "🌨️",
    lightsnowshowers: "🌨️",
    heavysnowshowers: "❄️",
  };

  return symbolMap[baseSymbol] || "☁️";
}
