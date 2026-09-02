"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
	error,
  statusCode = 500
}: {
		error: Error & { digest?: string };
		statusCode: number;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
				<NextError
					statusCode={statusCode}
					title={process.env.NODE_ENV.includes("dev") ? error.name ?? error.message : "There was an error!"}
				/>
      </body>
    </html>
  );
}
