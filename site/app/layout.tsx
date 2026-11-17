import type { Metadata, Viewport } from "next";
import { Jersey_10, Roboto } from "next/font/google";
import type { ReactNode } from "react";

import { APP_STORE_URL, SITE_URL } from "@/lib/links";
import "./globals.css";

// The app's two faces: Jersey 10 (pixel type) for anything shouted, Roboto
// for reading.
const jersey = Jersey_10({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const roboto = Roboto({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--font-body", display: "swap" });

const TITLE = "BeatBox'd — the clubbing passport for music lovers";
const DESCRIPTION =
  "Log the nights you danced, collect a stamp for every club you visit, save the tracks that got you, and see where your friends went out. Free on iPhone.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · BeatBox'd" },
  description: DESCRIPTION,
  applicationName: "BeatBox'd",
  keywords: [
    "clubbing app",
    "nightlife diary",
    "DJ set log",
    "rave passport",
    "electronic music",
    "techno",
    "house music",
    "track ID",
    "Letterboxd for DJ sets",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "BeatBox'd",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "The BeatBox'd stamp" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
  itunes: { appId: "6812424146" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0E0D0F",
  colorScheme: "dark",
};

// What search engines read the app as: a free iPhone app.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: "BeatBox'd",
  description: DESCRIPTION,
  url: SITE_URL,
  operatingSystem: "iOS",
  applicationCategory: "LifestyleApplication",
  downloadUrl: APP_STORE_URL,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${jersey.variable} ${roboto.variable}`}>
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      </body>
    </html>
  );
}
