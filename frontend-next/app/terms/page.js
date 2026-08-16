import React from 'react';
import TermsClient from './TermsClient';

export const metadata = {
  title: "Terms of Service",
  description: "Read the Terms of Service for using OpenJam listening rooms and queuing music.",
  alternates: { canonical: "https://www.openjam.fun/terms" },
};

export default function Page() {
  return <TermsClient />;
}
