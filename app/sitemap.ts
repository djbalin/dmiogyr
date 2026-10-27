import type { MetadataRoute } from "next";
import { placePath, siteUrl } from "@/lib/site";
import { KNOWN_LOCATIONS } from "@/lib/weather/locations";

/**
 * The front page and the built-in towns' pages. Any other place has a page too, but
 * listing every Danish village DMI knows would need a copy of its index; the
 * "Andre byer" links and shared links lead crawlers to the rest.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  // Both models run hourly.
  const changeFrequency = "hourly" as const;
  return [
    {
      url: new URL("/", base).toString(),
      lastModified: now,
      changeFrequency,
      priority: 1,
    },
    ...KNOWN_LOCATIONS.map((location) => ({
      url: new URL(placePath(location), base).toString(),
      lastModified: now,
      changeFrequency,
      priority: 0.8,
    })),
  ];
}
