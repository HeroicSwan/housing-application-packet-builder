import type { Metadata } from "next";
import { DemoBanner } from "@/components/demo-banner";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Housing Packet Builder", template: "%s · Housing Packet Builder" },
  description: "Prepare complete, human-reviewed housing application packets using synthetic demonstration data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {env.DEMO_BANNER ? <DemoBanner /> : null}
        {children}
      </body>
    </html>
  );
}
