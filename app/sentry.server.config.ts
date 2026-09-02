import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: "https://3f08fa2e06e97d895b396296231d9642@o4512013555662848.ingest.us.sentry.io/4512013556383744",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
  // Capture 100% in dev, 10% in production
  // Adjust based on your traffic volume
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
