import type { Metadata } from "next";
import { findLocation } from "@/lib/weather/locations";
import { Forecast } from "./components/forecast";

type PageProps = { searchParams: Promise<{ sted?: string }> };

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const location = findLocation((await searchParams).sted);
  return {
    title: `Vejret i ${location.name}`,
    description: `DMI's og Yr's vejrudsigt for ${location.name} side om side, time for time.`,
  };
}

export default async function Page({ searchParams }: PageProps) {
  // The location comes from the URL so a forecast can be linked to and shared;
  // the client restores the last-used one when the URL does not name it.
  const location = findLocation((await searchParams).sted);
  return (
    <main>
      <Forecast location={location} />
    </main>
  );
}
