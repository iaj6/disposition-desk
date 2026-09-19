import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The seed content and the local GROQ fallback are plain TS modules; nothing special needed.
  serverExternalPackages: ["groq-js"],
};

export default nextConfig;
