import { NextResponse } from "next/server";
import { YrAPIResponse } from "./types";

// Cache storage for Yr data (in production, use Redis or similar)
let cachedData: YrAPIResponse | null = null;
let cachedExpires: Date | null = null;
let cachedLastModified: string | null = null;

export async function GET() {
  // Copenhagen coordinates (limited to 4 decimals as per Yr requirements)
  const lat = 55.715;
  const lon = 12.561;
  const altitude = 10; // meters above sea level

  // Check if we have cached data that hasn't expired
  const now = new Date();
  if (cachedData && cachedExpires && now < cachedExpires) {
    console.log("Returning cached Yr data (not expired yet)");
    return NextResponse.json(cachedData, {
      headers: {
        "X-Cache": "HIT",
        "X-Cache-Expires": cachedExpires.toISOString(),
      },
    });
  }

  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}&altitude=${altitude}`;

  try {
    // Prepare headers
    const headers: Record<string, string> = {
      // User-Agent is REQUIRED by Yr API - must be identifying and unique
      // Format: AppName/Version (contact-info)
      "User-Agent": "dmiogyr-weather-app/1.0 github.com/djbalin",
    };

    // If we have cached data that expired, use If-Modified-Since to check for updates
    if (cachedLastModified) {
      headers["If-Modified-Since"] = cachedLastModified;
    }

    const response = await fetch(url, {
      headers,
      // Don't use Next.js cache - we handle caching manually per Yr's requirements
      cache: "no-store",
    });

    // Handle 304 Not Modified - data hasn't changed, continue using cached data
    if (response.status === 304) {
      console.log("Yr data not modified (304), extending cache");

      // Update expires time from the response
      const expiresHeader = response.headers.get("Expires");
      if (expiresHeader) {
        cachedExpires = new Date(expiresHeader);
      }

      return NextResponse.json(cachedData, {
        headers: {
          "X-Cache": "REVALIDATED",
          "X-Cache-Expires": cachedExpires?.toISOString() || "",
        },
      });
    }

    // Handle 203 Deprecated Product warning
    if (response.status === 203) {
      console.warn("Yr API: Product is deprecated, please check for updates");
    }

    // Handle 429 Too Many Requests (throttling)
    if (response.status === 429) {
      console.error(
        "Yr API: Being throttled! Check User-Agent and request frequency",
      );
      return NextResponse.json(
        { error: "Too many requests to Yr API. Please try again later." },
        { status: 429 },
      );
    }

    // Handle other error responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Yr API error:", response.status, errorText);

      // If we have cached data, return it even if expired
      if (cachedData) {
        console.log("Returning stale cached data due to API error");
        return NextResponse.json(cachedData, {
          headers: {
            "X-Cache": "STALE",
            "X-Cache-Warning": "API error, serving stale data",
          },
        });
      }

      throw new Error(`Yr API error: ${response.status}`);
    }

    // Success! Parse the data
    const data = (await response.json()) as YrAPIResponse;

    // Store cache control headers as per Yr best practices
    const expiresHeader = response.headers.get("Expires");
    const lastModifiedHeader = response.headers.get("Last-Modified");

    if (expiresHeader) {
      cachedExpires = new Date(expiresHeader);
      console.log(`Yr data cached until: ${cachedExpires.toISOString()}`);
    }

    if (lastModifiedHeader) {
      cachedLastModified = lastModifiedHeader;
      console.log(`Yr data last modified: ${lastModifiedHeader}`);
    }

    // Store the data
    cachedData = data;

    return NextResponse.json(data, {
      headers: {
        "X-Cache": "MISS",
        "X-Cache-Expires": cachedExpires?.toISOString() || "",
        "X-Last-Modified": cachedLastModified || "",
      },
    });
  } catch (error) {
    console.error("Error fetching Yr weather data:", error);

    // If we have cached data, return it even if stale
    if (cachedData) {
      console.log("Returning stale cached data due to fetch error");
      return NextResponse.json(cachedData, {
        headers: {
          "X-Cache": "STALE",
          "X-Cache-Warning": "Fetch error, serving stale data",
        },
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch weather data from Yr" },
      { status: 500 },
    );
  }
}
