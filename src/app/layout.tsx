import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveGuard — Crisis Command Center",
  description: "LiveGuard — Livestream Crisis Command Center: monitor, detect, respond",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <body>{children}</body>
    </html>
  );
}
