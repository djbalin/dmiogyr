import { NextResponse } from "next/server";
import { getForecast, UpstreamError } from "./service";
import type { ProviderId } from "./types";

/**
 * Both provider routes are the same handler with a different provider bound,
 * so that adding a third provider is a two-line file rather than a copy of the
 * error handling.
 */
export function forecastRoute(provider: ProviderId) {
  return async function GET(request: Request): Promise<NextResponse> {
    const location = new URL(request.url).searchParams.get("location");

    try {
      const forecast = await getForecast(provider, location);
      return NextResponse.json(forecast, {
        headers: {
          "X-Forecast-Freshness": forecast.freshness,
          // The browser gets a short window so a reload feels instant, while
          // the server-side cache above is what actually protects the upstream.
          "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
        },
      });
    } catch (error) {
      const status = error instanceof UpstreamError ? error.status : 502;
      // Messages read as a continuation of the provider's name, which the UI
      // puts in front of them.
      const message =
        error instanceof UpstreamError
          ? error.message
          : "kunne ikke kontaktes lige nu.";
      console.error(`[${provider}] forecast failed:`, error);
      return NextResponse.json({ error: message }, { status });
    }
  };
}
