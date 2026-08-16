import React from 'react';
import PrivacyClient from './PrivacyClient';

export const metadata = {
  title: "Privacy Policy",
  description: "Learn how OpenJam collects, uses, and safeguards your temporary session and listening room data.",
  alternates: { canonical: "https://www.openjam.fun/privacy" },
  openGraph: {
    title: "Privacy Policy | OpenJam",
    description: "Learn how OpenJam collects, uses, and safeguards your temporary session and listening room data.",
    url: "https://www.openjam.fun/privacy",
    siteName: "OpenJam",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://www.openjam.fun/static/img/hero_visual_showcase.webp",
        width: 1200,
        height: 630,
        alt: "OpenJam Privacy Policy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | OpenJam",
    description: "Learn how OpenJam collects, uses, and safeguards your temporary session and listening room data.",
    images: ["https://www.openjam.fun/static/img/hero_visual_showcase.webp"],
  },
};

export default function Page() {
  return <PrivacyClient />;
}
