import { NextResponse } from 'next/server';

import { env } from '@/lib/supabase/env';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { buildXml, parseXml } from '@/lib/vms/xml';

function inferName(email: string) {
  const local = email.split('@')[0] ?? 'Customer';
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  return cleaned.length >= 3 ? cleaned : 'Customer';
}

function extractCustomerId(xmlObj: any): number | null {
  const idRaw = xmlObj?.customer?.id ?? xmlObj?.customers?.customer?.id;
  const idNum = typeof idRaw === 'string' ? Number(idRaw) : typeof idRaw === 'number' ? idRaw : NaN;
  if (Number.isFinite(idNum) && idNum > 0) return idNum;

  const customers = xmlObj?.customers?.customer;
  if (Array.isArray(customers) && customers.length > 0) {
    const first = customers[0];
    const id = typeof first?.id === 'string' ? Number(first.id) : first?.id;
    if (Number.isFinite(id) && id > 0) return id;
  }

  return null;
}

export async function POST() {
  const { supabase, user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (profile?.vms_customer_id) {
    return NextResponse.json({ vms_customer_id: profile.vms_customer_id });
  }

  const email = user.email;
  if (!email) return NextResponse.json({ error: 'User has no email' }, { status: 400 });

  const vms = VmsClient.fromEnv();

  // Try search first to avoid duplicates
  const searchXml = await vms.request(`/customers?email=${encodeURIComponent(email)}`, { method: 'GET' });
  const searchObj = parseXml<any>(searchXml);
  let customerId = extractCustomerId(searchObj);

  if (!customerId) {
    const name = (user.user_metadata?.full_name as string | undefined) ?? inferName(email);
    const homeVenueId = env.VMS_HOME_VENUE_ID ?? 1;

    const customerXml = buildXml('customer', {
      name,
      home_venue_id: homeVenueId,
      email,
      email_optin: false,
      source: 'Web',
      if_duplicate_email_make_secondary: false
    });

    const createdXml = await vms.request('/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8'
      },
      body: customerXml
    });

    const createdObj = parseXml<any>(createdXml);
    customerId = extractCustomerId(createdObj);
  }

  if (!customerId) {
    return NextResponse.json({ error: 'Failed to resolve VMS customer id' }, { status: 502 });
  }

  await supabase.from('profiles').update({ vms_customer_id: customerId }).eq('id', user.id);

  return NextResponse.json({ vms_customer_id: customerId });
}


