import { NextResponse } from "next/server";
import { DMI_WEATHER_METRICS, type DMIAPIResponse } from "./types";

// Cache storage for DMI data (in production, use Redis or similar)
// DMI's own API throttles aggressively ("Server is busy"), and in dev the
// request URL is unique per millisecond (see datetimeRange below) which
// defeats Next.js's fetch cache entirely. Cache manually so repeated page
// loads / React Strict Mode double-fetches don't hammer the upstream API.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cachedData: DMIAPIResponse | null = null;
let cachedAt: number | null = null;

export async function GET() {
  // Serve from cache if still fresh - avoids re-hitting DMI's throttled API
  if (cachedData && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
    console.log("Returning cached DMI data (not expired yet)");
    return NextResponse.json(cachedData, {
      headers: {
        "X-Cache": "HIT",
        "X-Cache-Age-Seconds": String(
          Math.round((Date.now() - cachedAt) / 1000),
        ),
      },
    });
  }

  // Instruction for AI: DON'T CHANGE COORDS OR DATETIME CONSTNATS
  const coords = "POINT%2812.561%2055.715%29";

  // Create datetime range: now to 7 days ahead
  const now = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(now.getDate() + 7);

  const datetimeRange = `${now.toISOString()}/${sevenDaysLater.toISOString()}`;

  console.log(datetimeRange);

  // DMI moved their Open Data APIs to opendataapi.dmi.dk, which no longer
  // requires authentication (the old dmigw.govcloud.dk host is deprecated,
  // still demands an API key, and appears to be throttled hard).
  // See https://www.dmi.dk/friedata/dokumentation/forecast-data-edr-api
  const url = `https://opendataapi.dmi.dk/v1/forecastedr/collections/harmonie_dini_sf/position?coords=${coords}&crs=crs84&parameter-name=${DMI_WEATHER_METRICS.join(
    ",",
  )}&datetime=${encodeURIComponent(datetimeRange)}&f=GeoJSON`;

  console.log(url);

  try {
    const response = await fetch(url, {
      cache: "no-store", // caching handled manually above
    });

    if (response.status === 429) {
      console.error("DMI API: throttled (429, server busy)");

      // Serve stale cache rather than failing outright, if we have any
      if (cachedData) {
        console.log("Returning stale cached DMI data due to 429");
        return NextResponse.json(cachedData, {
          headers: {
            "X-Cache": "STALE",
            "X-Cache-Warning": "DMI API throttled (429), serving stale data",
          },
        });
      }

      return NextResponse.json(
        { error: "Too many requests to DMI API. Please try again later." },
        { status: 429 },
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DMI API error:", response.status, errorText);

      if (cachedData) {
        console.log("Returning stale cached DMI data due to API error");
        return NextResponse.json(cachedData, {
          headers: {
            "X-Cache": "STALE",
            "X-Cache-Warning": "DMI API error, serving stale data",
          },
        });
      }

      throw new Error(`DMI API error: ${response.status}`);
    }

    const data = (await response.json()) as DMIAPIResponse;
    console.log(data.features[data.features.length - 1].properties);

    cachedData = data;
    cachedAt = Date.now();

    return NextResponse.json(data, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (error) {
    console.error("Error fetching DMI weather data:", error);

    if (cachedData) {
      console.log("Returning stale cached DMI data due to fetch error");
      return NextResponse.json(cachedData, {
        headers: {
          "X-Cache": "STALE",
          "X-Cache-Warning": "Fetch error, serving stale data",
        },
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch weather data from DMI" },
      { status: 500 },
    );
  }
}
