import "./globals.css";
import Script from "next/script";
import ClientSocketProvider from "@/contexts/ClientSocketProvider";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import { PreloadResources } from "@/components/PreloadResources";
import { JsonLd } from "@/components/JsonLd";

const SITE_URL = "https://www.openjam.fun";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Open Jam — Listen Together",
  description: "Create and join public listening rooms. Discover music with friends in real-time.",
  manifest: "/manifest.json",
  icons: {
    icon: "/static/img/logo.png",
    apple: "/static/img/icon-192.png",
  },
  openGraph: {
    title: "Open Jam — Listen Together",
    description: "Create and join public listening rooms. Discover music with friends in real-time.",
    url: SITE_URL,
    siteName: "Open Jam",
    type: "website",
    images: [
      {
        url: "/static/img/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Open Jam — Listen Together",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Jam — Listen Together",
    description: "Create and join public listening rooms. Discover music with friends in real-time.",
    images: ["/static/img/og-image.svg"],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#08080a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PreloadResources />
        <JsonLd />
        <ClientSocketProvider>
          {children}
          <PwaInstallPrompt />
        </ClientSocketProvider>
        <Script src="/sw-register.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
