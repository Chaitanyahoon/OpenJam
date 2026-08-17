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
    default: "OpenJam — Listen to Music with Friends Online Free | Virtual Music Room",
    template: "%s | OpenJam"
  },
  description: "OpenJam is a virtual music room platform to listen to music with friends online free. Sync YouTube music with friends in a shared music listening room with real-time synced music playback.",
  keywords: [
    "openjam",
    "listen to music with friends online",
    "shared music listening room",
    "sync youtube music with friends",
    "listen music with friends online free",
    "virtual music room",
    "synced music playback",
    "real-time music sync",
    "collaborative music queue",
    "listen together free",
    "watch2gether alternative free",
    "spotify jam without premium",
    "virtual listening party app",
    "karaoke stage view lyrics online",
    "listen to youtube together in sync"
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/static/img/logo.png", type: "image/png" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/static/img/icon-192.png", sizes: "192x192" }
    ],
  },
  alternates: {
    canonical: "./",
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
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
    other: {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || ""
    }
  },
  openGraph: {
    title: "OpenJam — Listen to Music with Friends Online Free | Virtual Music Room",
    description: "OpenJam is a virtual music room platform to listen to music with friends online free. Sync YouTube music with friends in a shared music listening room with real-time synced music playback.",
    url: SITE_URL,
    siteName: "OpenJam",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/static/img/hero_visual_showcase.webp",
        width: 1200,
        height: 630,
        alt: "OpenJam — Listen to Music with Friends Online Free",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenJam — Listen to Music with Friends Online Free | Virtual Music Room",
    description: "OpenJam is a virtual music room platform to listen to music with friends online free. Sync YouTube music with friends in a shared music listening room with real-time synced music playback.",
    images: ["/static/img/hero_visual_showcase.webp"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OpenJam",
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
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

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
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
