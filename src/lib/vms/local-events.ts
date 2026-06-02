import { type SupabaseClient } from '@supabase/supabase-js';

import { type LocalHotlapEvent } from '@/lib/vms/types';

const LOCAL_EVENT_SELECT = 'id,vms_hotlap_event_id,slug,name,circuit_id,start_date,end_date,status,created_by,created_at,updated_at';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function findLocalHotlapEvent(supabase: SupabaseClient, id: string) {
  if (/^\d+$/.test(id)) {
    const { data, error } = await supabase
      .from('vms_hotlap_events')
      .select(LOCAL_EVENT_SELECT)
      .eq('vms_hotlap_event_id', Number(id))
      .maybeSingle();
    return { data: data as LocalHotlapEvent | null, error };
  }

  if (isUuid(id)) {
    const { data, error } = await supabase.from('vms_hotlap_events').select(LOCAL_EVENT_SELECT).eq('id', id).maybeSingle();
    return { data: data as LocalHotlapEvent | null, error };
  }

  const { data, error } = await supabase.from('vms_hotlap_events').select(LOCAL_EVENT_SELECT).eq('slug', id).maybeSingle();
  return { data: data as LocalHotlapEvent | null, error };
}
