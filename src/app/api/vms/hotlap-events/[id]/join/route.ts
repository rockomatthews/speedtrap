import { NextResponse } from 'next/server';

import { getAuthedProfile } from '@/lib/supabase/profile';
import { findLocalHotlapEvent } from '@/lib/vms/local-events';

function canJoin(status: string, endDate: string) {
  if (status === 'cancelled' || status === 'completed') return false;
  const end = Date.parse(endDate.replace(' ', 'T'));
  return !Number.isFinite(end) || Date.now() <= end;
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile?.username) {
    return NextResponse.json({ error: 'Create a racing username before joining a challenge.' }, { status: 412 });
  }

  const { data: event, error: eventError } = await findLocalHotlapEvent(supabase, id);
  if (eventError) return NextResponse.json({ error: `Failed to load challenge: ${eventError.message}` }, { status: 500 });
  if (!event) return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 });
  if (!canJoin(event.status, event.end_date)) {
    return NextResponse.json({ error: 'This challenge is no longer open for signup.' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('vms_hotlap_event_entries')
    .upsert({ event_id: event.id, profile_id: user.id }, { onConflict: 'event_id,profile_id' })
    .select('id,event_id,profile_id,joined_at')
    .single();

  if (error) return NextResponse.json({ error: `Failed to join challenge: ${error.message}` }, { status: 500 });
  return NextResponse.json({ joined: true, entry: data });
}
