import * as Sentry from "@sentry/nextjs";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// A faulty API route to test Sentry's error monitoring.
// It intentionally throws to raise a test error when called at request time
// (from the sentry-example page). Reading the incoming request keeps it
// request-time under `cacheComponents` so it is never prerendered at build.
export function GET(request: Request) {
  void request.url
  Sentry.logger.info("Sentry example API called");
  throw new SentryExampleAPIError(
    "This error is raised on the backend called by the example page.",
  );
}
