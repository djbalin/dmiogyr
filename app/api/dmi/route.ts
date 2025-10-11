import { NextResponse } from "next/server";
import { DMI_WEATHER_METRICS, DMIAPIResponse } from "./types";

export async function GET() {
  const apiKey = process.env.DMI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "DMI API key not configured" },
      { status: 500 },
    );
  }

  const coords = "POINT(12.561 55.715)"; // Copenhagen coordinates

  // Create datetime range: now to 7 days ahead
  const now = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(now.getDate() + 7);

  const datetimeRange = `${now.toISOString()}/${sevenDaysLater.toISOString()}`;

  const url = `https://dmigw.govcloud.dk/v1/forecastedr/collections/harmonie_dini_sf/position?coords=${encodeURIComponent(
    coords,
  )}&crs=crs84&parameter-name=${DMI_WEATHER_METRICS.join(
    ",",
  )}&datetime=${encodeURIComponent(datetimeRange)}&f=GeoJSON`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Gravitee-Api-Key": apiKey,
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DMI API error:", response.status, errorText);
      throw new Error(`DMI API error: ${response.status}`);
    }

    const data = (await response.json()) as DMIAPIResponse;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching DMI weather data:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data from DMI" },
      { status: 500 },
    );
  }
}
