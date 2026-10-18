import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Server Action request body must fit all files of one submission plus multipart overhead.
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 20);
const maxFiles = Number(process.env.MAX_FILES_PER_SUBMISSION || 5);
const bodySizeLimit = `${Math.ceil(maxUploadMb * maxFiles + 1)}mb` as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["mammoth", "unpdf", "pg"],
  experimental: {
    serverActions: { bodySizeLimit: bodySizeLimit as `${number}mb` },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
