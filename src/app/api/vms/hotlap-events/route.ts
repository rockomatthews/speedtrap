import { NextResponse } from 'next/server';

import { getAuthedProfile } from '@/lib/supabase/profile';
import { type LocalHotlapEvent } from '@/lib/vms/types';

function deriveStatus(event: Pick<LocalHotlapEvent, 'start_date' | 'end_date' | 'status'>) {
  if (event.status === 'cancelled' || event.status === 'draft') return event.status;

  const now = Date.now();
  const start = Date.parse(event.start_date.replace(' ', 'T'));
  const end = Date.parse(event.end_date.replace(' ', 'T'));

  if (Number.isFinite(start) && now < start) return 'scheduled';
  if (Number.isFinite(end) && now > end) return 'completed';
  return 'active';
}

export async function GET() {
  const { supabase, user } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('vms_hotlap_events')
    .select('id,vms_hotlap_event_id,slug,name,circuit_id,start_date,end_date,status,created_by,created_at,updated_at')
    .order('start_date', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Failed to load hotlap events: ${error.message}. Run migration 0009 in Supabase.` },
      { status: 500 }
    );
  }

  const events = ((data ?? []) as LocalHotlapEvent[]).map((event) => ({
    ...event,
    computedStatus: deriveStatus(event)
  }));

  return NextResponse.json({ events });
}
