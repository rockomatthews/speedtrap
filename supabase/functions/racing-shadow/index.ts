// @ts-nocheck -- Generated Deno entrypoint; source modules are typechecked in Next.js.
import {XMLValidator,XMLParser} from 'npm:fast-xml-parser@4.5.1';
import {createClient} from 'npm:@supabase/supabase-js@2.49.1';
const BOOKING_TIMEZONE='America/New_York';
const parseXml=(xml)=>new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:true,trimValues:true}).parse(xml);
const VmsClient={fromEnv(){throw Error('Explicit read-only adapter required');}};
export const ENGAGEMENT_MODE = 'shadow';
// Deliberately no email provider import, credentials, delivery worker or live-mode switch.
export function formatLap(ms) {
    return `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, '0')}`;
}
export function recordLostPreview(payload) {
    return {
        subject: 'Your Speed Trap record has been beaten',
        text: `Your previous best of ${formatLap(payload.previousMs)} on ${payload.boardLabel} has been beaten by ${((payload.previousMs - payload.newMs) / 1000).toFixed(3)} seconds. The new time is ${formatLap(payload.newMs)}. Ready for another run?`,
        bookingUrl: 'https://www.speedtrapracing.com/book',
        // No deep link to an unrelated hotlap board: all-time board mapping is a release gate.
        delivery: 'Disabled — shadow preview only',
        releaseGates: ['Verify matching public leaderboard and competition rules', 'Verify driver identity, email preferences and unsubscribe handling', 'Revalidate record immediately before delivery']
    };
}
function partsFor(date, timeZone = BOOKING_TIMEZONE) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
export function localDateTimeToUtc(date, time, timeZone = BOOKING_TIMEZONE) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute = 0, second = 0] = time.split(':').map(Number);
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    const guess = new Date(desired);
    const actualParts = partsFor(guess, timeZone);
    const actual = Date.UTC(Number(actualParts.year), Number(actualParts.month) - 1, Number(actualParts.day), Number(actualParts.hour), Number(actualParts.minute), Number(actualParts.second));
    return new Date(guess.getTime() + desired - actual);
}
export function utcToVenueDateTime(date, timeZone = BOOKING_TIMEZONE) {
    const parts = partsFor(typeof date === 'string' ? new Date(date) : date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
export function utcToVenueDate(date, timeZone = BOOKING_TIMEZONE) {
    const parts = partsFor(typeof date === 'string' ? new Date(date) : date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
}
export function utcToVenueTime(date, timeZone = BOOKING_TIMEZONE) {
    const parts = partsFor(typeof date === 'string' ? new Date(date) : date, timeZone);
    return `${parts.hour}:${parts.minute}`;
}
export function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60_000);
}
export function overlaps(leftStart, leftEnd, rightStart, rightEnd) {
    return leftStart < rightEnd && rightStart < leftEnd;
}
export function dayOfWeekForVenueDate(date) {
    return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}
/** Customer-facing booking times always use the venue timezone, never the device timezone. */
export function formatVenueBookingTime(value, timeZone = BOOKING_TIMEZONE) {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat('en-US', {
        timeZone, month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    }).format(date);
}
export function formatVenueBookingRange(start, end, timeZone = BOOKING_TIMEZONE) {
    const startLabel = formatVenueBookingTime(start, timeZone);
    if (!end)
        return startLabel;
    if (utcToVenueDate(start, timeZone) !== utcToVenueDate(end, timeZone)) {
        return `${startLabel} – ${formatVenueBookingTime(end, timeZone)}`;
    }
    const endLabel = new Intl.DateTimeFormat('en-US', {
        timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    }).format(new Date(end));
    return `${startLabel} – ${endLabel}`;
}
/** VMS wall-clock timestamps without an offset are venue-local, unlike stored UTC bookings. */
export function formatVmsBookingTime(value) {
    if (!value)
        return 'Time pending';
    const local = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?$)/);
    const date = local ? localDateTimeToUtc(local[1], local[2]) : new Date(value);
    return Number.isNaN(date.getTime()) ? 'Time pending' : formatVenueBookingTime(date);
}
function positive(value) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}
export function parseVmsLapPage(xml, sourceId, venueId) {
    if (XMLValidator.validate(xml) !== true)
        throw new Error('Invalid VMS XML; cursor retained.');
    const doc = parseXml(xml);
    if (!doc || !Object.hasOwn(doc, 'laps'))
        throw new Error('Missing VMS laps root; cursor retained.');
    const root = doc.laps;
    if (!root || !Number.isSafeInteger(Number(root.lap_results)) || Number(root.lap_results) < 0)
        throw new Error('Missing VMS result count; cursor retained.');
    const rows = root.lap == null ? [] : Array.isArray(root.lap) ? root.lap : [root.lap];
    return rows.map((r) => {
        const lapId = positive(r.id);
        if (!lapId)
            throw new Error('Invalid VMS lap ID; cursor retained.');
        const circuit = positive(r.circuit_id), car = positive(r.vehicle_id), venue = positive(r.venue_id);
        const driver = positive(r.customer_id), timeMs = positive(r.time_ms);
        const transmission = typeof r.transmission === 'string' ? r.transmission.trim() : '';
        let occurredAt = null;
        const date = String(r.date ?? '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
        if (date) {
            try {
                const d = localDateTimeToUtc(date[1], date[2]);
                if (Number.isFinite(d.getTime()))
                    occurredAt = d.toISOString();
            }
            catch { /* excluded below */ }
        }
        const exclusion = venue !== venueId ? 'other_or_unknown_venue' : !driver ? 'unlinked_driver' : !car || !circuit || !transmission ? 'incomplete_comparison_key' : !timeMs || !occurredAt ? 'invalid_time_or_date' : String(r.invalid) !== '0' ? 'invalid_or_unknown_validity' : null;
        return {
            sourceId, lapId, driverId: driver ? String(driver) : null,
            driverName: String(r.customer_name ?? 'Driver').slice(0, 150),
            boardKey: venue && car && circuit && transmission ? JSON.stringify([sourceId, venue, circuit, car, transmission]) : null,
            boardLabel: `${String(r.vehicle ?? `Car ${car}`).slice(0, 150)} at ${String(r.circuit ?? `Track ${circuit}`).slice(0, 150)} (${transmission || 'unknown transmission'})`,
            timeMs, occurredAt, valid: exclusion === null, exclusion
        };
    });
}
export function vmsLapSource(venueId, client = VmsClient.fromEnv()) {
    const sourceId = `vms:venue:${venueId}`;
    async function fetchPage(query) {
        return parseVmsLapPage(await client.request(`/laps?${query}`, { method: 'GET', signal: AbortSignal.timeout(15000) }), sourceId, venueId);
    }
    return {
        sourceId,
        async latestId() { return (await fetchPage('order=iddesc&count=1&invalid=1'))[0]?.lapId ?? 0; },
        async page(after, count) {
            const rows = await fetchPage(`id=${after + 1}&order=idasc&count=${count}&invalid=1`);
            if (rows.length > count || rows.some((r, i) => r.lapId <= after || (i > 0 && r.lapId <= rows[i - 1].lapId)))
                throw new Error('VMS returned a non-ascending page; cursor retained.');
            return rows;
        }
    };
}
export async function syncRacingShadow(db, source) {
    const { data: existing, error: readError } = await db.from('racing_shadow_sources').select('*').eq('source_id', source.sourceId).maybeSingle();
    if (readError)
        throw readError;
    if (!existing) {
        const maxId = await source.latestId();
        const { error } = await db.from('racing_shadow_sources').upsert({ source_id: source.sourceId, baseline_through: maxId }, { onConflict: 'source_id', ignoreDuplicates: true });
        if (error)
            throw error;
    }
    const { data: state, error } = await db.from('racing_shadow_sources').select('*').eq('source_id', source.sourceId).single();
    if (error)
        throw error;
    const rows = await source.page(Number(state.last_id), 500);
    const result = await db.rpc('racing_shadow_apply', { p_source: source.sourceId, p_version: state.version, p_after: state.last_id, p_rows: rows, p_eof: rows.length < 500, p_repair: false });
    if (result.error)
        throw result.error;
    // Bounded sweep repairs historical edits/deletions without generating retrospective alerts.
    const current = result.data;
    if (current.baseline_complete && Number(current.last_id) > 0) {
        const repair = await source.page(Number(current.repair_id), 500);
        const repaired = await db.rpc('racing_shadow_apply', { p_source: source.sourceId, p_version: current.version, p_after: current.repair_id, p_rows: repair, p_eof: repair.length < 500, p_repair: true });
        if (repaired.error)
            throw repaired.error;
        return { mode: 'shadow', state: repaired.data };
    }
    return { mode: 'shadow', state: current };
}

// No mail transport. No production database. Only GET /laps is permitted upstream.
const REVIEW_REF='kzymywpamdmfwnlwxzfj';
Deno.serve(async(request)=>{
 const url=Deno.env.get('SUPABASE_URL')||'';
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(url!==`https://${REVIEW_REF}.supabase.co`) return Response.json({error:'Review database mismatch'},{status:503});
 if(!key||!Deno.env.get('SHADOW_JOB_TOKEN')||request.headers.get('x-shadow-token')!==Deno.env.get('SHADOW_JOB_TOKEN'))return Response.json({error:'Unauthorized'},{status:401});
 if(request.method!=='POST')return Response.json({error:'POST required'},{status:405});
 if(Deno.env.get('RACING_ENGAGEMENT_SHADOW_ENABLED')!=='true')return Response.json({mode:'shadow',enabled:false,sendingEnabled:false});
 const venue=Number(Deno.env.get('VMS_HOME_VENUE_ID'));
 if(!Number.isSafeInteger(venue)||venue<=0)return Response.json({error:'Missing venue'},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
 const adapter={async request(path,init){
  if(!path.startsWith('/laps?')||init?.method!=='GET')throw Error('Only lap reads permitted');
  const response=await fetch('https://api.simracing.co.uk/v0.1'+path,{method:'GET',headers:{Authorization:`SRL ${Deno.env.get('VMS_API_KEY')}`},signal:init.signal});
  if(!response.ok)throw Error(`VMS HTTP ${response.status}`);
  return await response.text();
 }};
 const bootstrap=(await request.json().catch(()=>({}))).bootstrap===true;
 const deadline=Date.now()+40000;
 let result;
 for(let batch=0;batch<(bootstrap?10:1);batch++){
   result=await syncRacingShadow(db,vmsLapSource(venue,adapter));
   if(result.state?.baseline_complete||Date.now()>deadline)break;
 }
 console.log(JSON.stringify({event:'shadow_sync',source:result.state?.source_id,lastId:result.state?.last_id,baselineComplete:result.state?.baseline_complete,sendingEnabled:false}));
 return Response.json({...result,sendingEnabled:false});
 }catch(error){console.error('Shadow sync failed:',error instanceof Error?error.message:'Database operation failed');return Response.json({error:'Shadow sync failed; checkpoint retained',sendingEnabled:false},{status:502});}
});
