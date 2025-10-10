import { NextResponse } from "next/server";
import { APIResponse, WEATHER_METRICS } from "../types";

export async function GET() {
  const apiKey = process.env.DMI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "DMI API key not configured" },
      { status: 500 },
    );
  }

  console.log("Getting");

  const coords = "POINT%2812.561%2055.715%29"; // Copenhagen coordinates

  // Create datetime range: today to 7 days ahead
  const now = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(now.getDate() + 7);

  const datetimeRange = `${now.toISOString()}/${sevenDaysLater.toISOString()}`;

  console.log(datetimeRange);
  console.log(coords);

  const url = `https://dmigw.govcloud.dk/v1/forecastedr/collections/harmonie_dini_sf/position?coords=${coords}&crs=crs84&parameter-name=${WEATHER_METRICS.join(
    ",",
  )}&datetime=${encodeURIComponent(datetimeRange)}&f=GeoJSON&api-key=${apiKey}`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DMI API error:", response.status, errorText);
      throw new Error(`DMI API error: ${response.status}`);
    }

    const data = (await response.json()) as APIResponse;
    console.log(data.features[0].geometry);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 },
    );
  }
}
