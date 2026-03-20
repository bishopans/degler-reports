import { NextRequest } from 'next/server';

// Temporary test trigger — proxies to the digest endpoint with the correct auth
export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'www.deglerwhitingreports.com';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const cronSecret = process.env.CRON_SECRET;

  const res = await fetch(`${protocol}://${host}/api/digest`, {
    headers: {
      authorization: `Bearer ${cronSecret}`,
    },
  });

  const data = await res.json();
  return new Response(JSON.stringify(data, null, 2), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
