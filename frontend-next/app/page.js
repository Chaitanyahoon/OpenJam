import React from 'react';
import HomeClient from './HomeClient';

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
        url: "https://www.openjam.fun/static/img/og-image.png",
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
    images: ["https://www.openjam.fun/static/img/og-image.png"],
  }
};

const getBackendUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (url !== 'undefined' && url !== 'null' && url.trim() !== '') {
      return url.replace(/\/$/, '').replace(/\/health\/?$/, '');
    }
  }
  return 'https://api.openjam.fun';
};

async function getInitialRooms() {
  try {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/rooms`, {
      next: { revalidate: 15 },
    });
    if (res.ok) {
      const data = await res.json();
      return data.rooms || [];
    }
  } catch (err) {
    console.warn('[Page] Server-side room prefetch fallback:', err?.message || err);
  }
  return [];
}

export default async function Page() {
  const initialRooms = await getInitialRooms();
  return <HomeClient initialRooms={initialRooms} />;
}
