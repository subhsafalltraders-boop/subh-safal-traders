import type { NextConfig } from "next";

// @ts-expect-error - next-pwa does not have standard types
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  turbopack: {},
  /* config options here */
};

export default withPWA(nextConfig);
