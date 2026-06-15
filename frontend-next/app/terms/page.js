import React from 'react';
import TermsClient from './TermsClient';

export const metadata = {
  title: "Terms of Service — Open Jam",
  description: "Read the Terms of Service for using Open Jam listening rooms and queuing music.",
  openGraph: {
    title: "Terms of Service — Open Jam",
    description: "Read the Terms of Service for using Open Jam listening rooms and queuing music.",
    type: "website",
  }
};

export default function Page() {
  return <TermsClient />;
}
