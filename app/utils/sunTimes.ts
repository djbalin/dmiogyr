// Fetch sunrise and sunset times from MET Norway Sunrise API
// https://api.met.no/weatherapi/sunrise/3.0/documentation

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  solarnoon?: Date;
  solarmidnight?: Date;
}

// Cache to avoid repeated API calls for the same date
const sunTimesCache = new Map<string, SunTimes>();

export async function getSunTimes(date: Date): Promise<SunTimes> {
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

  // Check cache first
  if (sunTimesCache.has(dateStr)) {
    return sunTimesCache.get(dateStr)!;
  }

  try {
    const response = await fetch(`/api/sunrise?date=${dateStr}`);
    if (!response.ok) {
      throw new Error(`Sunrise API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse the times from the API response
    const sunTimes: SunTimes = {
      sunrise: data.properties.sunrise
        ? new Date(data.properties.sunrise.time)
        : new Date(date.setHours(6, 0, 0, 0)),
      sunset: data.properties.sunset
        ? new Date(data.properties.sunset.time)
        : new Date(date.setHours(18, 0, 0, 0)),
      solarnoon: data.properties.solarnoon
        ? new Date(data.properties.solarnoon.time)
        : undefined,
      solarmidnight: data.properties.solarmidnight
        ? new Date(data.properties.solarmidnight.time)
        : undefined,
    };

    // Cache the result
    sunTimesCache.set(dateStr, sunTimes);

    return sunTimes;
  } catch (error) {
    console.error("Error fetching sunrise/sunset data:", error);
    // Return fallback times (approximate for Copenhagen)
    const fallback: SunTimes = {
      sunrise: new Date(date.setHours(6, 0, 0, 0)),
      sunset: new Date(date.setHours(18, 0, 0, 0)),
    };
    return fallback;
  }
}

export function isNightTime(dateTime: Date, sunTimes: SunTimes): boolean {
  const time = dateTime.getTime();
  return time < sunTimes.sunrise.getTime() || time >= sunTimes.sunset.getTime();
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
