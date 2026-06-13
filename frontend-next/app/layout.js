import "./globals.css";
import ClientSocketProvider from "@/contexts/ClientSocketProvider";

export const metadata = {
  title: "Open Jam — Listen Together",
  description: "Create and join public listening rooms. Discover music with friends in real-time.",
  manifest: "/manifest.json",
  icons: {
    icon: "/static/img/logo.png",
    apple: "/static/img/icon-192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08080a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(
                function(registration) {
                  console.log('[Service Worker] registered successfully with scope:', registration.scope);
                },
                function(err) {
                  console.error('[Service Worker] registration failed:', err);
                }
              );
            });
          }
        ` }} />
      </head>
      <body>
        <ClientSocketProvider>
          {children}
        </ClientSocketProvider>
      </body>
    </html>
  );
}
