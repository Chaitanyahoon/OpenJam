import { NextResponse } from 'next/server';

const INDEXNOW_KEY = '5a8e2b9c7d1f4e3a8b6c0d2e1f4a7b9c';
const HOST = 'www.openjam.fun';

export async function POST(request) {
  try {
    const body = await request.json();
    const urls = Array.isArray(body.urls) ? body.urls : (body.url ? [body.url] : []);

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
    }

    const payload = {
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
      urlList: urls.map(u => u.startsWith('http') ? u : `https://${HOST}${u.startsWith('/') ? '' : '/'}${u}`)
    };

    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    return NextResponse.json({
      success: res.ok || res.status === 200 || res.status === 202,
      status: res.status,
      submitted: payload.urlList.length
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to submit to IndexNow' }, { status: 500 });
  }
}
