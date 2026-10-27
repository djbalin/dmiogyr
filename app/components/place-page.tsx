import { DEFAULT_LOCATION, type Location } from "@/lib/weather/locations";
import { resolveLocation } from "@/lib/weather/service";
import { AboutSection, StructuredData } from "./about";
import { Forecast } from "./forecast";

/**
 * The place a URL names, or the default town with a flag set when DMI
 * cannot place it right now, so the page can say so instead of silently
 * showing somewhere else.
 */
export async function locationFor(
  value: string | undefined,
): Promise<{ location: Location; unresolved: boolean }> {
  try {
    return { location: await resolveLocation(value), unresolved: false };
  } catch {
    return { location: DEFAULT_LOCATION, unresolved: true };
  }
}

/** The whole page for one place: the front page and every /vejret/ page. */
export function PlacePage({
  location,
  unresolved,
  canonicalPath,
  title,
  description,
}: {
  location: Location;
  unresolved: boolean;
  /** The URL this page is indexed under. */
  canonicalPath: string;
  /** The page's search-result title and snippet, for its structured data. */
  title: string;
  description: string;
}) {
  return (
    <main>
      <StructuredData
        location={location}
        path={canonicalPath}
        title={title}
        description={description}
      />
      <Forecast
        location={location}
        unresolved={unresolved}
        about={<AboutSection location={location} path={canonicalPath} />}
      />
    </main>
  );
}
