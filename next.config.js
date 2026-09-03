/** @type {import('next').NextConfig} */
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig = {
	cacheComponents: true,
	partialPrefetching: true,
  experimental: {
    useOffline: true,
    webpackMemoryOptimizations: true,
	},
  webpack: (config) => {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
}

export default withSentryConfig(nextConfig, {
  org: "isaac-bell-3a", // @TODO - make this configurable
  project: "leads-db",
  silent: !process.env.CI,
});
