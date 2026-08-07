import { NextResponse } from "next/server";
import { DMI_WEATHER_METRICS, type DMIAPIResponse } from "../dmi/types";

// For now, we're using DMI as the default provider
// This route maintains backward compatibility with the frontend
export async function GET() {
  const coords = "POINT(12.561 55.715)"; // Copenhagen coordinates

  // Create datetime range: now to 7 days ahead
  const now = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(now.getDate() + 7);

  const datetimeRange = `${now.toISOString()}/${sevenDaysLater.toISOString()}`;

  // DMI moved their Open Data APIs to opendataapi.dmi.dk, which no longer
  // requires authentication (the old dmigw.govcloud.dk host is deprecated
  // and still demands an API key).
  // See https://www.dmi.dk/friedata/dokumentation/forecast-data-edr-api
  const url = `https://opendataapi.dmi.dk/v1/forecastedr/collections/harmonie_dini_sf/position?coords=${encodeURIComponent(
    coords,
  )}&crs=crs84&parameter-name=${DMI_WEATHER_METRICS.join(
    ",",
  )}&datetime=${encodeURIComponent(datetimeRange)}&f=GeoJSON`;

  try {
    const response = await fetch(url, {
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
    console.error("Error fetching weather data:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 },
    );
  }
}
