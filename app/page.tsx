import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { HOME_DESCRIPTION, HOME_TITLE, placePath } from "@/lib/site";
import { DEFAULT_LOCATION, parseLocationId } from "@/lib/weather/locations";
import { locationFor, PlacePage } from "./components/place-page";

type PageProps = { searchParams: Promise<{ sted?: string }> };

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: HOME_TITLE, description: HOME_DESCRIPTION, url: "/" },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
};

/**
 * The front page: the default town, under the site's own name. A returning
 * visitor is sent on to their last place by the client.
 */
export default async function Page({ searchParams }: PageProps) {
  const { sted } = await searchParams;
  if (parseLocationId(sted)) {
    // Links from before places had their own paths (`/?sted=roskilde`,
    // `/?sted=2614481`) move permanently to them.
    const { location, unresolved } = await locationFor(sted);
    if (!unresolved) permanentRedirect(placePath(location));
  }
  return (
    <PlacePage
      location={DEFAULT_LOCATION}
      unresolved={false}
      canonicalPath="/"
      title={HOME_TITLE}
      description={HOME_DESCRIPTION}
    />
  );
}
