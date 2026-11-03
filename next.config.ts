import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "font-src 'self'",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  // Bring-your-own AI calls go straight from the browser to the provider the user picked.
  "connect-src 'self' https://api.openai.com https://api.anthropic.com https://openrouter.ai",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const dataFiles = ["./public/data/index.json", "./public/data/staples.json", "./public/data/t/**/*"];
const cardFiles = [...dataFiles, "./src/assets/fonts/*.ttf", "./node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"];

const config: NextConfig = {
  // Lets a second build (e.g. for recordings) live next to the main one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/r/[segment]": dataFiles,
    "/r/[segment]/opengraph-image": cardFiles,
    "/opengraph-image": cardFiles,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
      {
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default config;
