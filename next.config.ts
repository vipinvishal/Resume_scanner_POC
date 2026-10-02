import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "unpdf", "mammoth"],
  experimental: {
    // resumes are uploaded one per request, but allow generous bodies for big PDFs
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
