import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { placeDescription, placePath, placeTitle, siteUrl } from "@/lib/site";
import { parseLocationId } from "@/lib/weather/locations";
import { locationFor, PlacePage } from "../../../components/place-page";

type PageProps = { params: Promise<{ id: string; slug?: string[] }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { location, unresolved } = await locationFor(id);
  const title = placeTitle(location);
  const description = placeDescription(location);
  const url = new URL(placePath(location), siteUrl()).toString();
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    // Page-level metadata replaces the layout's twitter object wholesale.
    twitter: { card: "summary_large_image", title, description },
    // A place DMI could not resolve right now shows Copenhagen under this
    // URL; keep that out of the index until it resolves again.
    robots: unresolved ? { index: false, follow: true } : undefined,
  };
}

/**
 * One place's page, at `/vejret/<GeoNames id>/<name>`. The name is cosmetic:
 * a missing or outdated one redirects to the current spelling, so each place
 * has exactly one URL.
 */
export default async function Page({ params }: PageProps) {
  const { id, slug } = await params;
  if (!parseLocationId(decodeURIComponent(id))) notFound();

  const { location, unresolved } = await locationFor(decodeURIComponent(id));
  const path = placePath(location);
  const requested = `/vejret/${id}/${(slug ?? []).join("/")}`;
  if (!unresolved && requested !== path) permanentRedirect(path);

  return (
    <PlacePage
      location={location}
      unresolved={unresolved}
      canonicalPath={path}
      title={placeTitle(location)}
      description={placeDescription(location)}
    />
  );
}
