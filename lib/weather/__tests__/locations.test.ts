import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCATION,
  distanceKm,
  findKnownLocation,
  foldName,
  KNOWN_LOCATIONS,
  parseLocationId,
  roundCoordinate,
} from "../locations";
import { nearestTideStation } from "../tide-stations";

describe("KNOWN_LOCATIONS", () => {
  it("has unique ids and slugs, which the URL and localStorage rely on", () => {
    const ids = KNOWN_LOCATIONS.map((location) => location.id);
    const slugs = KNOWN_LOCATIONS.map((location) => location.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("places every entry inside Denmark's bounding box", () => {
    for (const location of KNOWN_LOCATIONS) {
      expect(location.lat).toBeGreaterThan(54);
      expect(location.lat).toBeLessThan(58);
      expect(location.lon).toBeGreaterThan(8);
      expect(location.lon).toBeLessThan(15.5);
    }
  });

  it("defaults to Copenhagen", () => {
    expect(DEFAULT_LOCATION.name).toBe("København");
    expect(DEFAULT_LOCATION.id).toBe("2618425");
  });
});

describe("parseLocationId", () => {
  it("accepts a bare GeoNames id", () => {
    expect(parseLocationId("2614481")).toBe("2614481");
    expect(parseLocationId(" 2614481 ")).toBe("2614481");
  });

  it("maps the old slugs to their ids, so old links keep working", () => {
    expect(parseLocationId("aarhus")).toBe("2624652");
  });

  it("rejects anything else", () => {
    expect(parseLocationId("atlantis")).toBeNull();
    expect(parseLocationId("12;drop")).toBeNull();
    expect(parseLocationId("")).toBeNull();
    expect(parseLocationId(null)).toBeNull();
    expect(parseLocationId(undefined)).toBeNull();
  });
});

describe("findKnownLocation", () => {
  it("finds a built-in town by id or slug, without its slug", () => {
    expect(findKnownLocation("2624652")?.name).toBe("Aarhus");
    expect(findKnownLocation("aarhus")).not.toHaveProperty("slug");
  });

  it("is null for a place it does not know", () => {
    expect(findKnownLocation("123")).toBeNull();
  });
});

describe("foldName", () => {
  it("ignores case, accents and the aa/å spelling", () => {
    expect(foldName("Aarhus")).toBe(foldName("århus"));
    expect(foldName("Rønne")).toBe(foldName("roenne"));
    expect(foldName("  Køge ")).toBe("koge");
  });
});

describe("distanceKm", () => {
  it("measures Copenhagen to Aarhus at about 157 km", () => {
    const [cph, aarhus] = KNOWN_LOCATIONS;
    expect(distanceKm(cph, aarhus)).toBeGreaterThan(150);
    expect(distanceKm(cph, aarhus)).toBeLessThan(165);
  });
});

describe("nearestTideStation", () => {
  it("picks the station in a coastal town", () => {
    expect(nearestTideStation({ lat: 55.6761, lon: 12.5683 })?.id).toBe(
      "30336",
    );
  });

  it("reaches a station a few kilometres away", () => {
    // Helsingør has none of its own; Sletten Havn is ~10 km south.
    expect(nearestTideStation({ lat: 56.0361, lon: 12.6136 })?.id).toBe(
      "30042",
    );
  });

  it("gives an inland place none rather than a distant one", () => {
    // Silkeborg, ~40 km from the nearest station.
    expect(nearestTideStation({ lat: 56.1697, lon: 9.5451 })).toBeNull();
  });
});

describe("roundCoordinate", () => {
  it("trims to the four decimals both providers ask for", () => {
    expect(roundCoordinate(55.676098)).toBe(55.6761);
    expect(roundCoordinate(12.568337)).toBe(12.5683);
  });
});
