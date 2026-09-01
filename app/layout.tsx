import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadsDB — Settings",
  description: "LeadsDB V2 — BYOK inference pipeline settings",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
