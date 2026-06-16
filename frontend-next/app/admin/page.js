import React from 'react';
import AdminClient from './AdminClient';

export const metadata = {
  title: "Admin Panel — Open Jam",
  description: "Administrative console for managing active rooms and monitoring connections on Open Jam.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://www.openjam.fun/admin" },
};

export default function Page() {
  return <AdminClient />;
}
