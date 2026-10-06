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
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const state = searchParams.get('state');

  const backendUrl = getBackendUrl();

  if (error) {
    if (state && (state.startsWith('openjam:') || state.startsWith('exp:'))) {
      const delimiter = state.includes('?') ? '&' : '?';
      return NextResponse.redirect(`${state}${delimiter}error=${encodeURIComponent(error)}`);
    }
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code) {
    if (state && (state.startsWith('openjam:') || state.startsWith('exp:'))) {
      const delimiter = state.includes('?') ? '&' : '?';
      return NextResponse.redirect(`${state}${delimiter}error=discord_no_code`);
    }
    return NextResponse.redirect(new URL('/?error=discord_no_code', request.url));
  }

  const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
  return NextResponse.redirect(`${backendUrl}/auth/discord/callback?code=${encodeURIComponent(code)}${stateParam}`);
}
