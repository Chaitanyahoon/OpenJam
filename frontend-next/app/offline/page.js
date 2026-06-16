import React from 'react';
import OfflineClient from './OfflineClient';

export const metadata = {
  title: "Offline — Open Jam",
  description: "It looks like you've lost your connection. We'll get you back listening with friends as soon as you're back online.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OfflineClient />;
}
