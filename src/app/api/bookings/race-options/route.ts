import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isHotlapEventActiveAt } from '@/lib/bookings/race-request';
import { VmsClient } from '@/lib/vms/client';

const querySchema = z.object({
  type: z.enum(['vehicle', 'circuit', 'event']),
  q: z.string().trim().default(''),
  startsAt: z.string().datetime().optional()
});

function rankByQuery(name: string, query: string) {
  const lower = name.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 0;
  if (lower.startsWith(q)) return 1;
  return 2;
}

function filterByQuery<T extends { name: string }>(items: T[], query: string) {
  const q = query.toLowerCase();
  return items
    .filter((item) => item.name.toLowerCase().includes(q))
    .sort((a, b) => rankByQuery(a.name, query) - rankByQuery(b.name, query) || a.name.localeCompare(b.name))
    .slice(0, 12);
}

export async function GET(request: NextRequest) {
  const raw = {
    type: request.nextUrl.searchParams.get('type') ?? '',
    q: request.nextUrl.searchParams.get('q') ?? '',
    startsAt: request.nextUrl.searchParams.get('startsAt') ?? undefined
  };
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid race option request.' }, { status: 400 });

  const query = parsed.data.q.trim();
  if (query.length < 2) return NextResponse.json({ options: [] });

  try {
    const vms = VmsClient.fromEnv();
    if (parsed.data.type === 'vehicle') {
      const vehicles = filterByQuery(await vms.getVehicles(), query);
      return NextResponse.json({
        options: vehicles.map((vehicle) => ({
          id: vehicle.id,
          name: vehicle.name,
          subtitle: vehicle.engine ?? 'Vehicle'
        }))
      });
    }

    if (parsed.data.type === 'circuit') {
      const circuits = filterByQuery(await vms.getCircuits(), query);
      return NextResponse.json({
        options: circuits.map((circuit) => ({
          id: circuit.id,
          name: circuit.name,
          subtitle: circuit.length ? `${circuit.length} m` : 'Circuit'
        }))
      });
    }

    if (!parsed.data.startsAt) return NextResponse.json({ error: 'Choose a booking time before searching events.' }, { status: 400 });
    const startsAt = new Date(parsed.data.startsAt);
    const activeEvents = (await vms.listHotlapEvents({ current: 1, future: 1, order: 'dateasc' })).filter((event) =>
      isHotlapEventActiveAt(event, startsAt)
    );
    const events = filterByQuery(activeEvents, query);
    return NextResponse.json({
      options: events.map((event) => ({
        id: event.id,
        name: event.name,
        subtitle: [event.circuitName, event.startDate && event.endDate ? `${event.startDate} - ${event.endDate}` : null].filter(Boolean).join(' · '),
        circuitId: event.circuitId ?? null,
        circuitName: event.circuitName ?? null
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load VMS race options.' }, { status: 502 });
  }
}
