import React from 'react';
import HomeClient from './HomeClient';
import { FaqJsonLd } from '@/components/FaqJsonLd';

export const metadata = {
  title: "Listen to Music with Friends Online Free | Virtual Music Room — OpenJam",
  description: "Join a shared music listening room on OpenJam to sync YouTube music with friends. Experience millisecond-accurate synced music playback and listen to music with friends online free.",
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
  alternates: { canonical: "https://www.openjam.fun" },
  openGraph: {
    title: "Listen to Music with Friends Online Free | Virtual Music Room — OpenJam",
    description: "Join a shared music listening room on OpenJam to sync YouTube music with friends. Experience millisecond-accurate synced music playback and listen to music with friends online free.",
    url: "https://www.openjam.fun",
    siteName: "OpenJam",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://www.openjam.fun/static/img/hero_visual_showcase.webp",
        width: 1200,
        height: 630,
        alt: "OpenJam — Listen to Music with Friends Online Free",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Listen to Music with Friends Online Free | Virtual Music Room — OpenJam",
    description: "Join a shared music listening room on OpenJam to sync YouTube music with friends. Experience millisecond-accurate synced music playback and listen to music with friends online free.",
    images: ["https://www.openjam.fun/static/img/hero_visual_showcase.webp"],
  }
};

export default function Page() {
  return (
    <>
      <FaqJsonLd />
      <HomeClient />
    </>
  );
}
