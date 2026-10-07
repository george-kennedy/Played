import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native modules must load at runtime via require(), not be webpack-bundled.
  serverExternalPackages: ["better-sqlite3", "@resvg/resvg-js"],
};

export default nextConfig;
