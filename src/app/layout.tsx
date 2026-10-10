'use client'

import type { Metadata } from "next";
import { AuthProvider } from "@/src/lib/auth/AuthProvider";
import "./globals.css";

// @TODO - jsonLD

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
			<body>
				<AuthProvider>
					{children}
				</AuthProvider>
			</body>
    </html>
  );
}
