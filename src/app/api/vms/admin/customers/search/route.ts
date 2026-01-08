import { NextResponse } from 'next/server';

import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { parseXml } from '@/lib/vms/xml';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const qEmail = url.searchParams.get('email');
  const qName = url.searchParams.get('name');
  const qCell = url.searchParams.get('cell');
  const qTel = url.searchParams.get('tel');

  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const entries = [
    ['email', qEmail],
    ['name', qName],
    ['cell', qCell],
    ['tel', qTel]
  ].filter(([, v]) => typeof v === 'string' && v.length > 0) as Array<[string, string]>;

  if (entries.length !== 1) {
    return NextResponse.json({ error: 'Provide exactly one query parameter: email|name|cell|tel' }, { status: 400 });
  }

  const [key, val] = entries[0];
  const vms = VmsClient.fromEnv();
  const xml = await vms.request(`/customers?${key}=${encodeURIComponent(val)}`, { method: 'GET' });
  const obj = parseXml<any>(xml);

  return NextResponse.json({ raw: obj });
}


