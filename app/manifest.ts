import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DMI og Yr: vejret side om side",
    short_name: "DMI og Yr",
    description: "Vejret fra DMI og Yr side om side, time for time.",
    lang: "da",
    start_url: "/",
    display: "standalone",
    background_color: "#eef4fb",
    theme_color: "#eef4fb",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
