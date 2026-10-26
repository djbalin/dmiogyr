import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockDmiResponse, mockYrResponse } from "../mock";
import {
  getForecast,
  resetForecastCache,
  resolveLocation,
  UpstreamError,
} from "../service";

const originalFetch = globalThis.fetch;

/** Move the cache's clock forward so an entry falls out of its TTL. */
function advanceClock(byMs: number) {
  const target = Date.now() + byMs;
  vi.spyOn(Date, "now").mockReturnValue(target);
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  resetForecastCache();
  delete process.env.WEATHER_MOCK;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("getForecast", () => {
  it("normalises an upstream response into the shared envelope", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(mockDmiResponse(55.6761, 12.5683)),
    ) as unknown as typeof fetch;

    const forecast = await getForecast("dmi", "koebenhavn");
    expect(forecast.provider).toBe("dmi");
    expect(forecast.location.name).toBe("København");
    expect(forecast.freshness).toBe("live");
    expect(forecast.hours.length).toBeGreaterThan(100);
    expect(forecast.hours[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back to the default location for an unknown id", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(mockDmiResponse(55.6761, 12.5683)),
    ) as unknown as typeof fetch;

    const forecast = await getForecast("dmi", "atlantis");
    expect(forecast.location.name).toBe("København");
  });

  it("serves the second request from cache without calling upstream again", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(mockDmiResponse(55.6761, 12.5683)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getForecast("dmi", "koebenhavn");
    await getForecast("dmi", "koebenhavn");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches each location separately", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(mockDmiResponse(55.6761, 12.5683)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getForecast("dmi", "koebenhavn");
    await getForecast("dmi", "aarhus");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("serves stale data rather than failing when upstream breaks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(mockDmiResponse(55.6761, 12.5683)))
      .mockResolvedValue(new Response("boom", { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = await getForecast("dmi", "koebenhavn");
    expect(first.freshness).toBe("live");

    // Expire the cache so the next call has to go upstream, and fail it.
    advanceClock(2 * 60 * 60 * 1000);

    const second = await getForecast("dmi", "koebenhavn");
    expect(second.freshness).toBe("stale");
    expect(second.hours).toEqual(first.hours);
  });

  it("raises a 429 through when there is nothing cached to fall back on", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("busy", { status: 429 }),
    ) as unknown as typeof fetch;

    await expect(getForecast("dmi", "koebenhavn")).rejects.toMatchObject({
      status: 429,
    });
  });

  it("reports an empty upstream response as an upstream failure", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ type: "FeatureCollection", features: [] }),
    ) as unknown as typeof fetch;

    await expect(getForecast("dmi", "koebenhavn")).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });

  it("sends Yr an identifying User-Agent, as its terms require", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse(mockYrResponse(55.6761, 12.5683)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getForecast("yr", "koebenhavn");
    const [, init] = fetchMock.mock.calls[0];
    const userAgent = (init.headers as Record<string, string>)["User-Agent"];
    expect(userAgent).toMatch(/dmiogyr-weather/);
    expect(userAgent).toMatch(/\(.+\)/);
  });

  it("revalidates Yr with If-Modified-Since and honours a 304", async () => {
    const lastModified = "Fri, 21 Aug 2026 10:00:00 GMT";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(mockYrResponse(55.6761, 12.5683), {
          headers: { "Last-Modified": lastModified },
        }),
      )
      .mockResolvedValue(new Response(null, { status: 304 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = await getForecast("yr", "koebenhavn");

    advanceClock(2 * 60 * 60 * 1000);

    const second = await getForecast("yr", "koebenhavn");
    const [, init] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)["If-Modified-Since"]).toBe(
      lastModified,
    );
    expect(second.freshness).toBe("live");
    expect(second.hours).toEqual(first.hours);
  });

  it("serves fixtures without touching the network in mock mode", async () => {
    process.env.WEATHER_MOCK = "1";
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const forecast = await getForecast("yr", "aarhus");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(forecast.hours.length).toBeGreaterThan(0);
    expect(forecast.location.name).toBe("Aarhus");
  });
});

describe("resolveLocation", () => {
  it("knows the built-in towns without asking anyone", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect((await resolveLocation("2624652")).name).toBe("Aarhus");
    expect((await resolveLocation("aarhus")).id).toBe("2624652");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the default for something that is not an id", async () => {
    expect((await resolveLocation("atlantis")).name).toBe("København");
    expect((await resolveLocation(null)).name).toBe("København");
  });

  it("places any other id through DMI, and reuses that call for its forecast", async () => {
    const dmi = { ...mockDmiResponse(55.4581, 12.1821), city: "Køge" };
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("dmi.dk")
        ? jsonResponse(dmi)
        : jsonResponse(mockYrResponse(55.4581, 12.1821)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const location = await resolveLocation("2618528");
    expect(location).toEqual({
      id: "2618528",
      name: "Køge",
      lat: 55.4581,
      lon: 12.1821,
    });

    const forecast = await getForecast("dmi", "2618528");
    expect(forecast.location.name).toBe("Køge");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await getForecast("yr", "2618528");
    const yrUrl = new URL(fetchMock.mock.calls[1][0]);
    expect(yrUrl.searchParams.get("lat")).toBe("55.4581");
    expect(yrUrl.searchParams.get("lon")).toBe("12.1821");
  });

  it("shares one DMI call between simultaneous requests for a new place", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(mockDmiResponse(55.4581, 12.1821)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await Promise.all([
      resolveLocation("2618528"),
      getForecast("dmi", "2618528"),
      resolveLocation("2618528"),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails rather than guessing when DMI gives no position", async () => {
    const {
      latitude: _lat,
      longitude: _lon,
      ...noPosition
    } = mockDmiResponse(55.4581, 12.1821);
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(noPosition),
    ) as unknown as typeof fetch;
    await expect(resolveLocation("2618528")).rejects.toMatchObject({
      status: 404,
    });
  });
});
