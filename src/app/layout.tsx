import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Groww Delta — The Living Watchlist",
  description: "A deterministic demo of an intent-aware market watchlist.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <AppHeader />
        <main id="main-content" className="page-shell">{children}</main>
      </body>
    </html>
  );
}
