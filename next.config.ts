import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  experimental: {
    // Enable ESM externals for better compatibility with ESM-only packages
    esmExternals: true,
  },
};

export default nextConfig;
