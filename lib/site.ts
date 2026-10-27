import type { Location } from "./weather/locations";

export const SITE_NAME = "DMI og Yr";

/**
 * The public origin, for canonical URLs, the sitemap and social cards.
 * `SITE_URL` wins when set; on Vercel the production domain is known without
 * it. Locally it is only ever seen by the developer.
 */
export function siteUrl(): URL {
  const explicit = process.env.SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

export const HOME_TITLE = "DMI og Yr: Vejret fra DMI og Yr side om side";
export const HOME_DESCRIPTION =
  "Se vejret fra DMI og Yr side om side, time for time. Sammenlign de to vejrudsigter for din by og se, hvor de er uenige om temperatur, regn og vind.";

/**
 * A place name as a URL segment: "København" → "koebenhavn", spelled the way
 * Danes type it without the letters, so the URL reads like the search.
 */
export function placeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sted"
  );
}

/**
 * The one URL a place's page is indexed under, e.g.
 * `/vejret/2614481/roskilde`, modelled on dmi.dk's own
 * `/lokation/show/DK/2614481/Roskilde/`: the GeoNames id finds the place,
 * the name is there for people and search engines.
 */
export function placePath(location: Pick<Location, "id" | "name">): string {
  return `/vejret/${encodeURIComponent(location.id)}/${placeSlug(location.name)}`;
}

/** Search-result title for a place's page. */
export function placeTitle(location: Location): string {
  return `Vejret i ${location.name} | DMI og Yr side om side`;
}

/** Search-result snippet for a place's page, kept under ~160 characters. */
export function placeDescription(location: Location): string {
  return `Vejret i ${location.name} fra DMI og Yr side om side, time for time. Se temperatur, regn og vind de næste dage, og hvor de to vejrudsigter er uenige.`;
}
