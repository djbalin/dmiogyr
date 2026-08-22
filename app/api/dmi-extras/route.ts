import { NextResponse } from "next/server";
import { getDmiExtras } from "@/lib/weather/extras-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const location = new URL(request.url).searchParams.get("location");
  const { extras, freshness } = await getDmiExtras(location);
  return NextResponse.json(extras, {
    headers: {
      "X-Forecast-Freshness": freshness,
      "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
    },
  });
}
