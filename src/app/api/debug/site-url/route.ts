import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json({
    host: url.host,
    origin: url.origin,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null
  });
}


