import { NextResponse } from 'next/server';

function getBackendUrl() {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (url !== 'undefined' && url !== 'null' && url.trim() !== '') {
      return url.replace(/\/$/, '');
    }
  }
  return process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : 'https://api.openjam.fun';
}

export async function GET(request) {
  const backendUrl = getBackendUrl();
  return NextResponse.redirect(`${backendUrl}/auth/discord`);
}
