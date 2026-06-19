import React from 'react';
import HomeClient from './HomeClient';

export const metadata = {
  title: "Listen Together in Real-Time | Open Jam",
  description: "Join public listening rooms, stream music synchronously with friends, queue up your favorite YouTube videos, and experience real-time collaborative playback. No registration required.",
  alternates: { canonical: "https://www.openjam.fun" },
  openGraph: {
    title: "Listen Together in Real-Time | Open Jam",
    description: "Join public listening rooms, stream music synchronously with friends, queue up your favorite YouTube videos, and experience real-time collaborative playback.",
    url: "https://www.openjam.fun",
  }
};

export default function Page() {
  return <HomeClient />;
}
