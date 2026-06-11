import "./globals.css";
import { SocketProvider } from "@/contexts/SocketContext";

export const metadata = {
  title: "Open Jam — Listen Together",
  description: "Create and join public listening rooms. Discover music with friends in real-time.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
