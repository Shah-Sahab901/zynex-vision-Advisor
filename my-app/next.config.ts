import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/analyze/pdf": [
      "./scripts/pdf-parse-worker.mjs",
      "./scripts/pdf-polyfill.mjs",
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdf-parse-modern/**/*",
      "./node_modules/pdfjs-dist/**/*",
    ],
  },
};

export default nextConfig;