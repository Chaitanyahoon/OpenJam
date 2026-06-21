import React, { Suspense } from 'react';
import ProfilePageClient from './ProfilePageClient';

export function generateStaticParams() {
  return [{ id: 'loading' }];
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#08080a',
        color: '#fff',
        fontFamily: 'sans-serif'
      }}>
        Loading Profile...
      </div>
    }>
      <ProfilePageClient />
    </Suspense>
  );
}
