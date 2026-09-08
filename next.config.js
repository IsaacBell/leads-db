/** @type {import('next').NextConfig} */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";

// leads-db is a standalone git repo nested inside the gridlab monorepo. Next.js
// runs Turbopack by default in v16, and Turbopack infers the project root from
// the nearest workspace manifest — which, here, sits at the gridlab root outside
// this repo's git boundary. Pin the root explicitly so Turbopack resolves
// `src/app` correctly instead of panicking ("app_dir must be a directory").
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
  org: "isaac-bell-3a", // @TODO - make this configurable
  project: "leads-db",
  silent: !process.env.CI,
});
