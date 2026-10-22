import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulse — AI study companion",
  description: "Ask Pulse anything — UNEB, Cambridge and IB help in one simple chat.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
