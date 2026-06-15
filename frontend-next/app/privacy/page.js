import React from 'react';
import PrivacyClient from './PrivacyClient';

export const metadata = {
  title: "Privacy Policy — Open Jam",
  description: "Learn how Open Jam collects, uses, and safeguards your temporary session and listening room data.",
  openGraph: {
    title: "Privacy Policy — Open Jam",
    description: "Learn how Open Jam collects, uses, and safeguards your temporary session and listening room data.",
    type: "website",
  }
};

export default function Page() {
  return <PrivacyClient />;
}
