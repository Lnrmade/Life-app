import type { Metadata, Viewport } from "next";
import "@fontsource/jersey-25";
import "@fontsource-variable/instrument-sans";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Life",
  description: "Track gym, sport, sleep, work and money. Your character grows with you.",
  appleWebApp: { capable: true, title: "Life", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0c0c0e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
