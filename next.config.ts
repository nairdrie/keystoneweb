import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      {
        source: '/editor',
        destination: '/design',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
