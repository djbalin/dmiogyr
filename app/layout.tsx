import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "DMI og Yr — sammenlign vejrudsigter",
    template: "%s — DMI og Yr",
  },
  description:
    "Se DMI's og Yr's vejrudsigt for danske byer side om side, time for time, og find ud af hvor de er uenige.",
  applicationName: "DMI og Yr",
  openGraph: {
    title: "DMI og Yr — sammenlign vejrudsigter",
    description:
      "To vejrudsigter for den samme by, side om side, time for time.",
    locale: "da_DK",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef4fb" },
    { media: "(prefers-color-scheme: dark)", color: "#070c16" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="da">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
