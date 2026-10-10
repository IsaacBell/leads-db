/** @type {import('next').NextConfig} */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    useOffline: true,
  },
};

export default withSentryConfig(nextConfig, {
  org: "isaac-bell-3a",
  project: "leads-db",
  silent: !process.env.CI,
});
