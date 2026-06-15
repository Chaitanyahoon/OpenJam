import React from 'react';
import HomeClient from './HomeClient';

export const metadata = {
  title: "Open Jam — Listen Together",
  description: "Create and join public listening rooms. Discover music with friends in real-time.",
  openGraph: {
    title: "Open Jam — Listen Together",
    description: "Create and join public listening rooms. Discover music with friends in real-time.",
    url: "https://openjam.onrender.com",
    siteName: "Open Jam",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Jam — Listen Together",
    description: "Create and join public listening rooms. Discover music with friends in real-time.",
  }
};

export default function Page() {
  return <HomeClient />;
}
