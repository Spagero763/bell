import type {Metadata, Viewport} from "next";
import {Inter, JetBrains_Mono, Instrument_Serif} from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({subsets: ["latin"], variable: "--font-inter", display: "swap"});
const mono = JetBrains_Mono({subsets: ["latin"], variable: "--font-mono-face", display: "swap"});
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bell.markets";
const TITLE = "Bell — the price of a stock market that is closed";
const DESCRIPTION =
  "Coinbase tokenized equities on Base trade around the clock. Their Chainlink feed holds Friday's close for 65 hours. Bell prices the reopen while the exchange is shut, and serves it through the same interface anything already reads.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {default: TITLE, template: "%s — Bell"},
  description: DESCRIPTION,
  applicationName: "Bell",
  keywords: [
    "tokenized stocks",
    "Base",
    "Coinbase tokenized equities",
    "B20",
    "Chainlink",
    "oracle staleness",
    "weekend gap",
    "opening print",
    "onchain equities",
    "AAPLc",
  ],
  authors: [{name: "Bell"}],
  alternates: {canonical: "/"},
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Bell",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {index: true, follow: true, "max-image-preview": "large", "max-snippet": -1},
  },
  category: "finance",
  other: {
    // Ownership verification for base.dev, which pairs the domain with the app.
    "base:app_id": "693d00d2d19763ca26ddc253",
  },
};

export const viewport: Viewport = {
  themeColor: "#060709",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Bell",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  url: SITE,
  offers: {"@type": "Offer", price: "0", priceCurrency: "USD"},
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-void"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}}
        />
      </body>
    </html>
  );
}
