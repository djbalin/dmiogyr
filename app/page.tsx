import type { Metadata } from "next";
import { DEFAULT_LOCATION, type Location } from "@/lib/weather/locations";
import { resolveLocation } from "@/lib/weather/service";
import { Forecast } from "./components/forecast";

type PageProps = { searchParams: Promise<{ sted?: string }> };

/**
 * The place the URL names, or the default town with a flag set when DMI
 * cannot place it right now, so the page can say so instead of silently
 * showing somewhere else.
 */
async function locationFor(
  sted: string | undefined,
): Promise<{ location: Location; unresolved: boolean }> {
  try {
    return { location: await resolveLocation(sted), unresolved: false };
  } catch {
    return { location: DEFAULT_LOCATION, unresolved: true };
  }
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { location } = await locationFor((await searchParams).sted);
  return {
    title: `Vejret i ${location.name}`,
    description: `DMI's og Yr's vejrudsigt for ${location.name} side om side, time for time.`,
  };
}

export default async function Page({ searchParams }: PageProps) {
  // The location comes from the URL so a forecast can be linked to and shared;
  // the client restores the last-used one when the URL does not name one.
  const { location, unresolved } = await locationFor((await searchParams).sted);
  return (
    <main>
      <Forecast location={location} unresolved={unresolved} />
    </main>
  );
}
