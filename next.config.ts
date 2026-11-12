import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El Agent SDK lanza un proceso nativo: debe ejecutarse sin empaquetar.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  reactStrictMode: true,
};

export default nextConfig;
