import React from 'react';
import HomeClient from './HomeClient';

export const metadata = {
  alternates: { canonical: "https://www.openjam.fun" },
};

export default function Page() {
  return <HomeClient />;
}
