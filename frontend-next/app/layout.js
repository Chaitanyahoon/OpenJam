import "./globals.css";
import Script from "next/script";
import ClientSocketProvider from "@/contexts/ClientSocketProvider";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import { PreloadResources } from "@/components/PreloadResources";
import { JsonLd } from "@/components/JsonLd";
import { Outfit, Poppins, JetBrains_Mono, Righteous } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display-next",
  display: "swap",
});

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ui-next",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-next",
  display: "swap",
});

const righteous = Righteous({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-righteous-next",
  display: "swap",
});

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
        url: "/static/img/hero_visual_showcase.webp",
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
    images: ["/static/img/hero_visual_showcase.webp"],
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
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#08080a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${poppins.variable} ${jetbrainsMono.variable} ${righteous.variable}`}>
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
