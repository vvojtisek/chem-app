import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/app-providers";
import { AuthGate } from "@/components/auth-gate";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

import "@fontsource-variable/atkinson-hyperlegible-next";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anorganická chemie",
  description: "Offline výuková aplikace pro anorganickou chemii.",
  applicationName: "Anorganická chemie",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f6f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b131b" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="cs">
      <body>
        <AppProviders>
          <AuthGate>
            <ServiceWorkerRegistration />
            {children}
          </AuthGate>
        </AppProviders>
      </body>
    </html>
  );
}
