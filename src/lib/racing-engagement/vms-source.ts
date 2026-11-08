import { XMLValidator } from 'fast-xml-parser';
import { VmsClient } from '@/lib/vms/client';
import { parseXml } from '@/lib/vms/xml';
import { localDateTimeToUtc } from '@/lib/bookings/time';
import { type RacingLap, type RacingLapSource } from '@/lib/racing-engagement/model';

function positive(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
export function parseVmsLapPage(xml: string, sourceId: string, venueId: number): RacingLap[] {
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid VMS XML; cursor retained.');
  const doc = parseXml<any>(xml);
  if (!doc || !Object.hasOwn(doc, 'laps')) throw new Error('Missing VMS laps root; cursor retained.');
  const root = doc.laps;
  if (!root || !Number.isSafeInteger(Number(root.lap_results)) || Number(root.lap_results) < 0) throw new Error('Missing VMS result count; cursor retained.');
  const rows = root.lap == null ? [] : Array.isArray(root.lap) ? root.lap : [root.lap];
  return rows.map((r: any) => {
    const lapId = positive(r.id);
    if (!lapId) throw new Error('Invalid VMS lap ID; cursor retained.');
    const circuit = positive(r.circuit_id), car = positive(r.vehicle_id), venue = positive(r.venue_id);
    const driver = positive(r.customer_id), timeMs = positive(r.time_ms);
    const transmission = typeof r.transmission === 'string' ? r.transmission.trim() : '';
    let occurredAt: string | null = null;
    const date = String(r.date ?? '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
    if (date) { try { const d = localDateTimeToUtc(date[1], date[2]); if (Number.isFinite(d.getTime())) occurredAt = d.toISOString(); } catch { /* excluded below */ } }
    const exclusion = venue !== venueId ? 'other_or_unknown_venue' : !driver ? 'unlinked_driver' : !car || !circuit || !transmission ? 'incomplete_comparison_key' : !timeMs || !occurredAt ? 'invalid_time_or_date' : String(r.invalid) !== '0' ? 'invalid_or_unknown_validity' : null;
    return {
      sourceId, lapId, driverId: driver ? String(driver) : null,
      driverName: String(r.customer_name ?? 'Driver').slice(0, 150),
      boardKey: venue && car && circuit && transmission ? JSON.stringify([sourceId, venue, circuit, car, transmission]) : null,
      boardLabel: `${String(r.vehicle ?? `Car ${car}`).slice(0,150)} at ${String(r.circuit ?? `Track ${circuit}`).slice(0,150)} (${transmission || 'unknown transmission'})`,
      timeMs, occurredAt, valid: exclusion === null, exclusion
    };
  });
}
export function vmsLapSource(venueId: number, client = VmsClient.fromEnv()): RacingLapSource {
  const sourceId = `vms:venue:${venueId}`;
  async function fetchPage(query: string) {
    return parseVmsLapPage(await client.request(`/laps?${query}`, {method:'GET', signal:AbortSignal.timeout(15000)}), sourceId, venueId);
  }
  return {
    sourceId,
    async latestId() { return (await fetchPage('order=iddesc&count=1&invalid=1'))[0]?.lapId ?? 0; },
    async page(after, count) {
      const rows = await fetchPage(`id=${after + 1}&order=idasc&count=${count}&invalid=1`);
      if (rows.length > count || rows.some((r,i)=>r.lapId<=after || (i>0 && r.lapId<=rows[i-1].lapId))) throw new Error('VMS returned a non-ascending page; cursor retained.');
      return rows;
    }
  };
}
