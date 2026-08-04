import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Standalone output for the Cloud Run container image.
  output: "standalone",
  // Keep file tracing rooted in this project (avoids picking a parent lockfile).
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
