import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Lets the iOS app on a real iPhone load `next dev` via your Mac's Bonjour name (http://my-mac.local:3000)
  allowedDevOrigins: ["*.local"],
};

export default nextConfig;
