import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["scraper-kit"],
  // Keep puppeteer-core + chromium out of the Next bundle - they must load as
  // CommonJS at runtime so @sparticuz/chromium can resolve its native binary.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // Trace the Chromium binary tarballs into the cron Function bundle. The
  // vercel.json includeFiles glob alone wasn't dragging the bin/ payload
  // into /var/task on the deployed function; the Next-native tracing path
  // covers it correctly.
  outputFileTracingIncludes: {
    "/api/cron/scrape": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/@sparticuz/chromium/lib/**/*",
    ],
  },
};

export default nextConfig;
