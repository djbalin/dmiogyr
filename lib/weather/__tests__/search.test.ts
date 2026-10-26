import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDmiSearchUrl, normaliseDmiSearch } from "../providers/dmi-search";
import { resetSearchCache, searchPlaces } from "../search-service";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetSearchCache();
  delete process.env.WEATHER_MOCK;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("buildDmiSearchUrl", () => {
  it("asks DMI's place index for an exact or prefix match on the name", () => {
    const url = new URL(buildDmiSearchUrl("Roskilde", 10));
    expect(url.origin + url.pathname).toBe(
      "https://www.dmi.dk/solr/city_core/select",
    );
    expect(url.searchParams.get("q")).toBe(
      '(name:"Roskilde" AND realm:1)^4 OR (name_ngram:"Roskilde" AND realm:1)',
    );
    expect(url.searchParams.get("rows")).toBe("10");
    expect(url.searchParams.get("wt")).toBe("json");
  });

  it("keeps quotes and backslashes in the query from breaking out of the phrase", () => {
    const q = new URL(buildDmiSearchUrl('a" OR id:*\\', 5)).searchParams.get(
      "q",
    );
    expect(q).toContain('name:"a\\" OR id:*\\\\"');
  });
});

describe("normaliseDmiSearch", () => {
  it("reads id, name and municipality, tolerating array-valued fields", () => {
    const results = normaliseDmiSearch(
      {
        response: {
          docs: [
            { id: 2614481, name: "Roskilde", municipality: "Roskilde" },
            { id: ["2614482"], name_ngram: ["Roskilde Ny"] },
          ],
        },
      },
      10,
    );
    expect(results).toEqual([
      { id: "2614481", name: "Roskilde", region: "Roskilde" },
      { id: "2614482", name: "Roskilde Ny" },
    ]);
  });

  it("drops duplicates, unusable docs, and anything past the limit", () => {
    const results = normaliseDmiSearch(
      {
        response: {
          docs: [
            { id: "1", name: "Lyngby", municipality: "Lyngby-Taarbæk" },
            { id: "2", name: "Lyngby", municipality: "Lyngby-Taarbæk" },
            { id: "1", name: "Lyngby igen" },
            { id: "x", name: "Ikke et id" },
            { id: "3" },
            { id: "4", name: "Lyngby", municipality: "Syddjurs" },
            { id: "5", name: "Lyngså" },
          ],
        },
      },
      2,
    );
    expect(results.map((place) => place.id)).toEqual(["1", "4"]);
  });

  it("copes with an empty or malformed response", () => {
    expect(normaliseDmiSearch({}, 5)).toEqual([]);
    expect(
      normaliseDmiSearch(
        null as unknown as Parameters<typeof normaliseDmiSearch>[0],
        5,
      ),
    ).toEqual([]);
  });
});

describe("searchPlaces", () => {
  it("offers the built-in towns before two letters are typed", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const results = await searchPlaces("k");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(results[0].name).toBe("København");
  });

  it("asks DMI once per query and caches the answer", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            response: { docs: [{ id: "2618425", name: "København" }] },
          }),
        ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(await searchPlaces("køb")).toEqual([
      { id: "2618425", name: "København" },
    ]);
    await searchPlaces(" KØB ");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports DMI failing as an upstream error", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("down", { status: 503 }),
    ) as unknown as typeof fetch;
    await expect(searchPlaces("odense")).rejects.toMatchObject({ status: 502 });
  });

  it("searches the built-in towns in mock mode, accent-insensitively", async () => {
    process.env.WEATHER_MOCK = "1";
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect((await searchPlaces("ro")).map((place) => place.name)).toEqual([
      "Roskilde",
      "Rønne",
    ]);
    expect((await searchPlaces("roenne")).map((place) => place.name)).toEqual([
      "Rønne",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
