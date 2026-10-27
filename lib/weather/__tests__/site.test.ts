import { afterEach, describe, expect, it } from "vitest";
import {
  placeDescription,
  placePath,
  placeSlug,
  placeTitle,
  siteUrl,
} from "../../site";
import { DEFAULT_LOCATION, findKnownLocation } from "../locations";

const roskilde = findKnownLocation("roskilde");
if (!roskilde) throw new Error("fixture missing");

afterEach(() => {
  delete process.env.SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});

describe("siteUrl", () => {
  it("prefers SITE_URL, then Vercel's production domain", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "dmiogyr.vercel.app";
    expect(siteUrl().origin).toBe("https://dmiogyr.vercel.app");
    process.env.SITE_URL = "https://vejr.example.dk";
    expect(siteUrl().origin).toBe("https://vejr.example.dk");
  });
});

describe("placeSlug", () => {
  it("spells Danish letters the way they are typed without them", () => {
    expect(placeSlug("København")).toBe("koebenhavn");
    expect(placeSlug("Ærøskøbing")).toBe("aeroeskoebing");
    expect(placeSlug("Århus")).toBe("aarhus");
  });

  it("turns everything else into single hyphens", () => {
    expect(placeSlug("Lyngby-Taarbæk")).toBe("lyngby-taarbaek");
    expect(placeSlug(" Ny  Ølstykke (Egedal) ")).toBe("ny-oelstykke-egedal");
    expect(placeSlug("Højer Sluse")).toBe("hoejer-sluse");
    expect(placeSlug("Saint-Étienne")).toBe("saint-etienne");
    expect(placeSlug("!!!")).toBe("sted");
  });
});

describe("placePath", () => {
  it("is the GeoNames id followed by the name", () => {
    expect(placePath(DEFAULT_LOCATION)).toBe("/vejret/2618425/koebenhavn");
    expect(placePath(roskilde)).toBe("/vejret/2614481/roskilde");
  });
});

describe("placeTitle and placeDescription", () => {
  it("name the place and both services", () => {
    expect(placeTitle(roskilde)).toBe(
      "Vejret i Roskilde | DMI og Yr side om side",
    );
    expect(placeDescription(roskilde)).toMatch(
      /^Vejret i Roskilde fra DMI og Yr/,
    );
  });

  it("stay within what search results show", () => {
    for (const location of [DEFAULT_LOCATION, roskilde]) {
      expect(placeTitle(location).length).toBeLessThanOrEqual(60);
      expect(placeDescription(location).length).toBeLessThanOrEqual(160);
    }
  });
});
