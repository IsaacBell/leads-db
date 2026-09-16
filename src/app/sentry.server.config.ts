import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN_ENV = "SENTRY_DSN";
const dsn = process.env[SENTRY_DSN_ENV];

if (!!dsn)
Sentry.init({
	dsn,
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    userInfo: false,
    httpBodies: [],
  },
  // Capture 100% in dev, 10% in production
  // Adjust based on your traffic volume
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
