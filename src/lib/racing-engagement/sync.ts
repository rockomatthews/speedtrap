import { type SupabaseClient } from '@supabase/supabase-js';
import { type RacingLapSource } from '@/lib/racing-engagement/model';

export async function syncRacingShadow(db: SupabaseClient, source: RacingLapSource) {
  const {data: existing, error: readError} = await db.from('racing_shadow_sources').select('*').eq('source_id',source.sourceId).maybeSingle();
  if (readError) throw readError;
  if (!existing) {
    const maxId = await source.latestId();
    const {error} = await db.from('racing_shadow_sources').upsert({source_id:source.sourceId, baseline_through:maxId}, {onConflict:'source_id',ignoreDuplicates:true});
    if(error) throw error;
  }
  const {data: state,error} = await db.from('racing_shadow_sources').select('*').eq('source_id',source.sourceId).single();
  if(error) throw error;
  const rows = await source.page(Number(state.last_id),500);
  const result = await db.rpc('racing_shadow_apply', {p_source:source.sourceId,p_version:state.version,p_after:state.last_id,p_rows:rows,p_eof:rows.length<500,p_repair:false});
  if(result.error) throw result.error;
  // Bounded sweep repairs historical edits/deletions without generating retrospective alerts.
  const current = result.data;
  if(current.baseline_complete && Number(current.last_id)>0) {
    const repair = await source.page(Number(current.repair_id),500);
    const repaired = await db.rpc('racing_shadow_apply', {p_source:source.sourceId,p_version:current.version,p_after:current.repair_id,p_rows:repair,p_eof:repair.length<500,p_repair:true});
    if(repaired.error) throw repaired.error;
    return {mode:'shadow', state:repaired.data};
  }
  return {mode:'shadow',state:current};
}
