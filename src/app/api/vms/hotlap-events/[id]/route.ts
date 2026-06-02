import { NextResponse } from 'next/server';

import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { findLocalHotlapEvent } from '@/lib/vms/local-events';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: localEvent, error } = await findLocalHotlapEvent(supabase, id);
  if (error) {
    return NextResponse.json({ error: `Failed to load hotlap event metadata: ${error.message}` }, { status: 500 });
  }
  if (!localEvent) return NextResponse.json({ error: 'Hotlap event not found.' }, { status: 404 });

  try {
    const vms = VmsClient.fromEnv();
    const [detail, viewerCustomer] = await Promise.all([
      vms.getHotlapEvent(localEvent.vms_hotlap_event_id, { invalid: 1 }),
      profile?.vms_customer_id ? vms.getCustomer(profile.vms_customer_id) : Promise.resolve(null)
    ]);
    const { data: entry } = await supabase
      .from('vms_hotlap_event_entries')
      .select('id,joined_at')
      .eq('event_id', localEvent.id)
      .eq('profile_id', user.id)
      .maybeSingle();
    return NextResponse.json({
      localEvent,
      viewerCustomerId: profile?.vms_customer_id ?? null,
      viewerCustomerName: viewerCustomer?.name ?? null,
      joined: Boolean(entry),
      entry: entry ?? null,
      event: detail.event,
      subEvents: detail.subEvents
    });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}
