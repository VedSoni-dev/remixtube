import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { SITE, siteUrl } from "@/lib/site";
import "./globals.css";

const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-display", display: "swap" });
const text = Instrument_Sans({ subsets: ["latin"], variable: "--font-text", display: "swap" });
const code = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: { title: SITE.tagline, description: SITE.description, siteName: SITE.name, type: "website" },
  twitter: { card: "summary_large_image", title: SITE.tagline, description: SITE.description },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#12110e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${code.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
