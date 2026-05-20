import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: ["hr4you.enf.net.pl", "10.3.3.169", "10.3.3.169:3000", "localhost:3000"],
    },
  },
};

export default nextConfig;
