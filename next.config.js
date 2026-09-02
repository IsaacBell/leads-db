/** @type {import('next').NextConfig} */
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig = {
  webpack: (config) => {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
}

export default withSentryConfig(nextConfig, {
  org: "isaac-bell-3a", // @TODO - make this configurable
  project: "javascript-nextjs",
  silent: !process.env.CI,
});
