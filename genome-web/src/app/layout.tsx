import type { Metadata, Viewport } from "next";

import { Toaster } from "@/components/ui/toaster";
import { BRAND } from "@/lib/brand";
import { PlayerProvider } from "@/lib/player/PlayerProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  applicationName: BRAND.name,
  themeColor: "#0e0c18",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0e0c18",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans">
        <PlayerProvider>
          {children}
          <Toaster />
        </PlayerProvider>
      </body>
    </html>
  );
}
