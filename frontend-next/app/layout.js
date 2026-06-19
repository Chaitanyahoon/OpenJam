import "./globals.css";
import Script from "next/script";
import ClientSocketProvider from "@/contexts/ClientSocketProvider";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import { PreloadResources } from "@/components/PreloadResources";
import { JsonLd } from "@/components/JsonLd";

const SITE_URL = "https://www.openjam.fun";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Open Jam — Listen Together in Real-Time",
    template: "%s | Open Jam"
  },
  description: "Create and join public listening rooms. Stream music, sync playback with friends, share queues, and discover new songs together in real-time.",
  manifest: "/manifest.json",
  icons: {
    icon: "/static/img/logo.png",
    apple: "/static/img/icon-192.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Open Jam — Listen Together in Real-Time",
    description: "Create and join public listening rooms. Stream music, sync playback with friends, share queues, and discover new songs together in real-time.",
    url: SITE_URL,
    siteName: "Open Jam",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/static/img/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Open Jam — Listen Together in Real-Time",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Jam — Listen Together in Real-Time",
    description: "Create and join public listening rooms. Stream music, sync playback with friends, share queues, and discover new songs together in real-time.",
    images: ["/static/img/og-image.svg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Open Jam",
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
