import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { FAVICON_SVG_DATA_URI } from "@/lib/icons";
import { AppProviders } from "./providers";
import { siteConfig } from "@/lib/site";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F1F2F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1117" },
  ],
  colorScheme: "light dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.author, url: siteConfig.url }],
  creator: siteConfig.author,
  publisher: siteConfig.author,
  applicationName: siteConfig.name,
  category: "productivity",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  icons: { icon: FAVICON_SVG_DATA_URI, apple: FAVICON_SVG_DATA_URI },
  manifest: "/manifest.webmanifest",
  formatDetection: { email: false, address: false, telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    applicationCategory: "Productivity",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
