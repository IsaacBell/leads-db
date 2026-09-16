import * as Sentry from "@sentry/nextjs";
import { registerOTel } from '@vercel/otel'

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./sentry.server.config");
		await import("./instrumentation.node");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
	}

	registerOTel({ serviceName: 'leads-db' })
}

export const onRequestError = Sentry.captureRequestError;
