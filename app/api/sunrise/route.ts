import { NextResponse } from "next/server";

// Copenhagen coordinates
const COPENHAGEN_LAT = 55.676098;
const COPENHAGEN_LON = 12.568337;
const TIMEZONE_OFFSET = "+01:00"; // Central European Time (adjust for DST if needed)

interface SunEventTime {
  time: string;
  elevation?: number;
  azimuth?: number;
  disc_centre_elevation?: number;
}

interface SunriseAPIResponse {
  type: string;
  geometry: {
    type: string;
    coordinates: number[];
  };
  when: {
    interval: string[];
  };
  properties: {
    body: string;
    sunrise?: SunEventTime;
    sunset?: SunEventTime;
    solarnoon?: SunEventTime;
    solarmidnight?: SunEventTime;
  };
}

const cache = new Map<string, { data: SunriseAPIResponse; expires: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: "Date parameter is required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const cacheKey = `sunrise-${date}`;
  const now = Date.now();

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > now) {
    return NextResponse.json(cached.data);
  }

  const url = `https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${COPENHAGEN_LAT}&lon=${COPENHAGEN_LON}&date=${date}&offset=${TIMEZONE_OFFSET}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "github.com/djbalin",
      },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sunrise API error:", response.status, errorText);
      throw new Error(`Sunrise API error: ${response.status}`);
    }

    const data = (await response.json()) as SunriseAPIResponse;

    // Cache for 24 hours
    cache.set(cacheKey, {
      data,
      expires: now + 86400000,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching sunrise data:", error);
    return NextResponse.json(
      { error: "Failed to fetch sunrise data" },
      { status: 500 },
    );
  }
}
