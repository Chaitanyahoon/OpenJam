import React from 'react';
import TermsClient from './TermsClient';

export const metadata = {
  title: "Terms of Service",
  description: "Read the Terms of Service for using OpenJam listening rooms and queuing music.",
  alternates: { canonical: "https://www.openjam.fun/terms" },
  openGraph: {
    title: "Terms of Service | OpenJam",
    description: "Read the Terms of Service for using OpenJam listening rooms and queuing music.",
    url: "https://www.openjam.fun/terms",
    siteName: "OpenJam",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://www.openjam.fun/static/img/hero_visual_showcase.webp",
        width: 1200,
        height: 630,
        alt: "OpenJam Terms of Service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | OpenJam",
    description: "Read the Terms of Service for using OpenJam listening rooms and queuing music.",
    images: ["https://www.openjam.fun/static/img/hero_visual_showcase.webp"],
  },
};

export default function Page() {
  return <TermsClient />;
}
