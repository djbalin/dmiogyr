import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/weather/search-service";
import { UpstreamError } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const results = await searchPlaces(query);
    return NextResponse.json(
      { results },
      // Results for a prefix barely change; let the browser reuse them while
      // the user backspaces and retypes.
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502;
    console.error("[search] failed:", error);
    return NextResponse.json(
      { error: "Søgningen virker ikke lige nu." },
      { status },
    );
  }
}
