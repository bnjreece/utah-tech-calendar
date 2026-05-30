import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["scraper-kit"],
  // Keep puppeteer-core + chromium out of the Next bundle - they must load as
  // CommonJS at runtime so @sparticuz/chromium can resolve its native binary.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
