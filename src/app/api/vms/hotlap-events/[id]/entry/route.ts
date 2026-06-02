import { NextResponse } from 'next/server';

import { getAuthedProfile } from '@/lib/supabase/profile';
import { findLocalHotlapEvent } from '@/lib/vms/local-events';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: event, error: eventError } = await findLocalHotlapEvent(supabase, id);
  if (eventError) return NextResponse.json({ error: `Failed to load challenge: ${eventError.message}` }, { status: 500 });
  if (!event) return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 });

  const { data: entry, error } = await supabase
    .from('vms_hotlap_event_entries')
    .select('id,event_id,profile_id,joined_at')
    .eq('event_id', event.id)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: `Failed to load challenge entry: ${error.message}` }, { status: 500 });
  return NextResponse.json({ joined: Boolean(entry), entry: entry ?? null });
}
