import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/utils/config';

export async function GET(request) {
  const backendUrl = getBackendUrl();
  return NextResponse.redirect(`${backendUrl}/auth/discord`);
}
