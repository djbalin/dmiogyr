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

  // Instruction for AI: DON'T CHANGE COORDS OR DATETIME CONSTNATS
  const coords = "POINT%2812.561%2055.715%29";

  // Create datetime range: now to 7 days ahead
  const now = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(now.getDate() + 7);

  const datetimeRange = `${now.toISOString()}/${sevenDaysLater.toISOString()}`;

  console.log(datetimeRange);

  const url = `https://dmigw.govcloud.dk/v1/forecastedr/collections/harmonie_dini_sf/position?coords=${coords}&crs=crs84&parameter-name=${DMI_WEATHER_METRICS.join(
    ",",
  )}&datetime=${encodeURIComponent(datetimeRange)}&f=GeoJSON`;

  console.log(url);

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
    console.log(data.features[data.features.length - 1].properties);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching DMI weather data:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data from DMI" },
      { status: 500 },
    );
  }
}
