import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
