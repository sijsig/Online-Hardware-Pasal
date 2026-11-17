import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  experimental: {
    turbo: false, // Disable Turbopack due to HMR issues
  },
};

export default nextConfig;
