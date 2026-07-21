import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lerato Platform",
  description: "Multi-organization management platform for Lerato Foundation, Darajani Sports Academy, and Agape in Action.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
