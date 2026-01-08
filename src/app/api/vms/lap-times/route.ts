import { NextResponse } from 'next/server';

import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { parseXml } from '@/lib/vms/xml';

function toInt(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const index = toInt(url.searchParams.get('index')) ?? 0;
  const count = toInt(url.searchParams.get('count')) ?? 100;

  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile?.vms_customer_id) {
    return NextResponse.json({ error: 'Missing vms_customer_id. Call POST /api/vms/customers/ensure first.' }, { status: 412 });
  }

  const vms = VmsClient.fromEnv();
  const xml = await vms.request(
    `/customers/${profile.vms_customer_id}/lap_times?index=${index}&count=${count}`,
    { method: 'GET' }
  );

  const obj = parseXml<any>(xml);
  // The docs show a `<customer>` root with `<results><result>...</result></results>`
  const results = obj?.customer?.results?.result ?? [];
  const list = Array.isArray(results) ? results : results ? [results] : [];

  return NextResponse.json({
    index,
    count,
    raw: obj,
    results: list
  });
}


