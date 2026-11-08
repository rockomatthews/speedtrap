import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { vmsLapSource } from '@/lib/racing-engagement/vms-source';
import { syncRacingShadow } from '@/lib/racing-engagement/sync';
export async function runRacingShadow() {
  if (process.env.RACING_ENGAGEMENT_SHADOW_ENABLED !== 'true') return {mode:'shadow',enabled:false};
  const venueId = Number(process.env.VMS_HOME_VENUE_ID);
  if(!Number.isSafeInteger(venueId) || venueId<=0) throw new Error('Set VMS_HOME_VENUE_ID before collecting racing records.');
  return syncRacingShadow(createSupabaseAdminClient(),vmsLapSource(venueId));
}
