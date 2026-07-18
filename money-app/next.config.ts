import type { NextConfig } from "next";

// Deliberately no PWA / service worker / manifest here — this is a plain,
// non-installable website. That's the whole point of splitting it out from
// the main ice cream app: downloading/installing that app should not also
// pull in this cash calculator.
const nextConfig: NextConfig = {
  compress: true,
};

export default nextConfig;
