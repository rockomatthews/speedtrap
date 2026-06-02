import { env } from '@/lib/supabase/env';
import {
  type VmsCatalog,
  type VmsCircuit,
  type VmsClass,
  type VmsCustomerProfile,
  type VmsCustomerUpdateInput,
  type VmsHotlapEventDetail,
  type VmsHotlapEventInput,
  type VmsHotlapEventSummary,
  type VmsHotlapLeaderboardRow,
  type VmsHotlapSubEvent,
  type VmsVehicle,
  type VmsVenue
} from '@/lib/vms/types';
import { buildXml, parseXml } from '@/lib/vms/xml';

export class VmsError extends Error {
  status: number;
  body?: string;
  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = 'VmsError';
    this.status = status;
    this.body = body;
  }
}

export type VmsClientOptions = {
  timezoneOffsetHours?: number;
};

function summarizeErrorBody(body: string) {
  const text = body
    .replace(/<\?xml[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 240 ? `${text.slice(0, 240)}...` : text;
}

function timezoneOffsetHours(timeZone?: string) {
  if (!timeZone) return undefined;
  try {
    const offsetPart = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset'
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    const match = offsetPart?.match(/^GMT([+-]\d{1,2})(?::(\d{2}))?$/);
    if (!match) return undefined;
    const hours = Number(match[1]);
    const minutes = match[2] ? Number(match[2]) : 0;
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
    return hours + Math.sign(hours) * (minutes / 60);
  } catch {
    return undefined;
  }
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return null;
}

function idFromUri(uri: string | null): number | null {
  if (!uri) return null;
  const match = uri.match(/\/(\d+)(?:\?.*)?$/);
  return match ? toNumber(match[1]) : null;
}

function compactQuery(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

function normalizeCircuit(raw: any): VmsCircuit | null {
  const id = toNumber(raw?.id ?? raw?.circuit_id);
  const name = toStringOrNull(raw?.name ?? raw?.circuit_name ?? raw?.circuit);
  if (!id || !name) return null;
  return { id, name, length: toNumber(raw?.length ?? raw?.circuit_length) };
}

function normalizeVehicle(raw: any): VmsVehicle | null {
  const id = toNumber(raw?.id ?? raw?.vehicle_id);
  const name = toStringOrNull(raw?.name ?? raw?.vehicle_name ?? raw?.vehicle);
  if (!id || !name) return null;
  return { id, name, engine: toStringOrNull(raw?.engine ?? raw?.vehicle_engine) };
}

function normalizeClass(raw: any): VmsClass | null {
  const id = toNumber(raw?.id ?? raw?.class_id);
  const name = toStringOrNull(raw?.name ?? raw?.class_name);
  if (!id || !name) return null;
  return { id, name, shortName: toStringOrNull(raw?.short_name), icon: toStringOrNull(raw?.icon ?? raw?.class_icon) };
}

function normalizeVenue(raw: any): VmsVenue | null {
  const id = toNumber(raw?.id ?? raw?.venue_id);
  const name = toStringOrNull(raw?.name ?? raw?.venue_name);
  if (!id || !name) return null;
  return { id, name };
}

function normalizeMemberships(raw: any): string[] {
  const memberships = asArray(raw?.membership ?? raw);
  return memberships
    .map((membership: any) => toStringOrNull(membership?.name ?? membership))
    .filter(Boolean) as string[];
}

function normalizeCustomer(raw: any): VmsCustomerProfile | null {
  const id = toNumber(raw?.id ?? raw?.customer_id);
  const name = toStringOrNull(raw?.name ?? raw?.customer_name);
  if (!id || !name) return null;
  const classUri = toStringOrNull(raw?.class_uri);
  return {
    id,
    name,
    tel: toStringOrNull(raw?.tel),
    cell: toStringOrNull(raw?.cell),
    email: toStringOrNull(raw?.email),
    emailOptin: toBooleanOrNull(raw?.email_optin),
    postalCode: toStringOrNull(raw?.postal_code),
    homeVenue: toStringOrNull(raw?.home_venue ?? raw?.venue_name),
    className: toStringOrNull(raw?.class ?? raw?.class_name),
    classId: toNumber(raw?.class_id) ?? idFromUri(classUri),
    memberships: normalizeMemberships(raw?.memberships),
    lapsRecorded: toNumber(raw?.laps_recorded),
    lastVisit: toStringOrNull(raw?.last_visit),
    lastVehicle: toStringOrNull(raw?.last_vehicle),
    lastCircuit: toStringOrNull(raw?.last_circuit),
    lastGroupEvent: toStringOrNull(raw?.last_group_event),
    lastRaceEvent: toStringOrNull(raw?.last_race_event),
    customerUri: toStringOrNull(raw?.customer_uri),
    venueUri: toStringOrNull(raw?.venue_uri),
    classUri,
    lapTimesUri: toStringOrNull(raw?.lap_times_uri),
    vehicleUri: toStringOrNull(raw?.vehicle_uri),
    circuitUri: toStringOrNull(raw?.circuit_uri),
    raceEventUri: toStringOrNull(raw?.race_event_uri)
  };
}

function buildCustomerUpdateXml(input: VmsCustomerUpdateInput) {
  const value: Record<string, unknown> = {};
  if (input.name !== undefined) value.name = input.name;
  if (input.tel !== undefined) value.tel = input.tel ?? '';
  if (input.cell !== undefined) value.cell = input.cell ?? '';
  if (input.email !== undefined) value.email = input.email ?? '';
  if (input.emailOptin !== undefined) value.email_optin = input.emailOptin ?? false;
  if (input.postalCode !== undefined) value.postal_code = input.postalCode ?? '';
  if (input.classId !== undefined) value.class_id = input.classId ?? '';
  return buildXml('customer', value);
}

function normalizeHotlapSummary(raw: any): VmsHotlapEventSummary | null {
  const id = toNumber(raw?.id ?? raw?.hotlap_event_id);
  const name = toStringOrNull(raw?.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    startDate: toStringOrNull(raw?.start_date),
    endDate: toStringOrNull(raw?.end_date),
    qualificationPercentage: toNumber(raw?.qualification_percentage),
    circuitId: toNumber(raw?.circuit_id),
    circuitName: toStringOrNull(raw?.circuit_name)
  };
}

function normalizeLeaderboardRow(raw: any, index: number): VmsHotlapLeaderboardRow {
  return {
    rank: index + 1,
    date: toStringOrNull(raw?.date),
    customerId: toNumber(raw?.customer_id),
    customerName: toStringOrNull(raw?.customer_name),
    lapId: toNumber(raw?.lap_id ?? raw?.id),
    lapTimeMs: toNumber(raw?.lap_time_ms ?? raw?.time_ms),
    lapTimeStr: toStringOrNull(raw?.lap_time_str ?? raw?.time_str),
    transmission: toStringOrNull(raw?.transmission),
    vehicleId: toNumber(raw?.vehicle_id),
    vehicleName: toStringOrNull(raw?.vehicle_name ?? raw?.vehicle),
    vehicleEngine: toStringOrNull(raw?.vehicle_engine),
    classId: toNumber(raw?.class_id),
    className: toStringOrNull(raw?.class_name),
    classIcon: toStringOrNull(raw?.class_icon),
    venueId: toNumber(raw?.venue_id),
    venueName: toStringOrNull(raw?.venue_name),
    invalid: toNumber(raw?.invalid),
    verified: toNumber(raw?.verified),
    telemetryUri: toStringOrNull(raw?.telemetry_uri)
  };
}

function normalizeSubEvent(raw: any): VmsHotlapSubEvent | null {
  const name = toStringOrNull(raw?.name);
  if (!name) return null;
  const resultList = asArray(raw?.results?.result).map(normalizeLeaderboardRow);
  return {
    id: toNumber(raw?.sub_event_id ?? raw?.id),
    name,
    circuitId: toNumber(raw?.circuit_id),
    circuitName: toStringOrNull(raw?.circuit_name),
    circuitLength: toNumber(raw?.circuit_length),
    results: resultList
  };
}

function buildHotlapEventXml(input: VmsHotlapEventInput) {
  const value: Record<string, unknown> = {
    name: input.name,
    start_date: input.startDate,
    end_date: input.endDate,
    venues: { venue_id: input.venueIds },
    circuit_id: input.circuitId,
    sub_event: input.subEvents.map((subEvent) => {
      const out: Record<string, unknown> = { name: subEvent.name };
      if (subEvent.id) out.sub_event_id = subEvent.id;
      if (subEvent.vehicleIds?.length) out.vehicles = { vehicle_id: subEvent.vehicleIds };
      if (subEvent.classIds?.length) out.classes = { class_id: subEvent.classIds };
      return out;
    })
  };

  if (input.qualificationPercentage) value.qualification_percentage = input.qualificationPercentage;

  return buildXml('hotlap_event', value);
}

function buildHotlapEventUpdateXml(input: VmsHotlapEventInput) {
  const value: Record<string, unknown> = {
    name: input.name,
    start_date: input.startDate,
    end_date: input.endDate,
    venues: { venue_id: input.venueIds },
    circuit_id: input.circuitId
  };

  if (input.qualificationPercentage) value.qualification_percentage = input.qualificationPercentage;

  return buildXml('hotlap_event', value);
}

export class VmsClient {
  private baseUrl = 'https://api.simracing.co.uk/v0.1';
  private apiKey: string;
  private timezoneOffsetHours?: number;

  constructor(apiKey: string, opts?: VmsClientOptions) {
    this.apiKey = apiKey;
    this.timezoneOffsetHours = opts?.timezoneOffsetHours;
  }

  static fromEnv(opts?: VmsClientOptions) {
    if (!env.VMS_API_KEY) throw new Error('Missing VMS_API_KEY');
    return new VmsClient(env.VMS_API_KEY, {
      timezoneOffsetHours: opts?.timezoneOffsetHours ?? timezoneOffsetHours(env.VMS_VENUE_TIMEZONE)
    });
  }

  async request(path: string, init?: RequestInit) {
    const url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `SRL ${this.apiKey}`);

    // For endpoints that support past/future logic, docs recommend providing timezone-offset.
    if (this.timezoneOffsetHours !== undefined) {
      headers.set('timezone-offset', String(this.timezoneOffsetHours));
    }

    const res = await fetch(url, {
      ...init,
      headers,
      // Avoid caching user-specific API responses
      cache: 'no-store'
    });

    const body = await res.text();

    if (!res.ok) {
      const detail = summarizeErrorBody(body);
      const message =
        res.status === 401
          ? 'VMS authentication failed.'
          : res.status === 403
            ? 'VMS API key is missing customer/PII permissions for this request. Enable customer read/write and PII/customer data access for this key in the SRL developer API settings.'
            : res.status === 429
              ? 'VMS API rate limit exceeded.'
              : `VMS request failed (${res.status})${detail ? `: ${detail}` : ''}`;
      throw new VmsError(message, res.status, body);
    }

    return body;
  }

  private async getParsed<T = any>(path: string) {
    const xml = await this.request(path, { method: 'GET' });
    return parseXml<T>(xml);
  }

  async getCircuits(): Promise<VmsCircuit[]> {
    const obj = await this.getParsed<any>('/circuits');
    return asArray(obj?.circuits?.circuit).map(normalizeCircuit).filter(Boolean) as VmsCircuit[];
  }

  async getVehicles(): Promise<VmsVehicle[]> {
    const obj = await this.getParsed<any>('/vehicles');
    return asArray(obj?.vehicles?.vehicle).map(normalizeVehicle).filter(Boolean) as VmsVehicle[];
  }

  async getClasses(): Promise<VmsClass[]> {
    const obj = await this.getParsed<any>('/classes');
    return asArray(obj?.classes?.class).map(normalizeClass).filter(Boolean) as VmsClass[];
  }

  async getVenues(): Promise<VmsVenue[]> {
    const obj = await this.getParsed<any>('/venues');
    return asArray(obj?.venues?.venue).map(normalizeVenue).filter(Boolean) as VmsVenue[];
  }

  async getCatalog(): Promise<VmsCatalog> {
    const [circuits, vehicles, classes, venues] = await Promise.all([
      this.getCircuits(),
      this.getVehicles(),
      this.getClasses(),
      this.getVenues()
    ]);
    return { circuits, vehicles, classes, venues };
  }

  async getCustomer(id: number): Promise<VmsCustomerProfile | null> {
    const obj = await this.getParsed<any>(`/customers/${id}`);
    return normalizeCustomer(obj?.customer ?? obj);
  }

  async updateCustomer(id: number, input: VmsCustomerUpdateInput): Promise<VmsCustomerProfile | null> {
    const updatedXml = await this.request(`/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      body: buildCustomerUpdateXml(input)
    });
    const obj = parseXml<any>(updatedXml);
    return normalizeCustomer(obj?.customer ?? obj);
  }

  async listHotlapEvents(params?: {
    past?: number;
    current?: number;
    future?: number;
    order?: 'dateasc' | 'datedesc';
  }): Promise<VmsHotlapEventSummary[]> {
    const obj = await this.getParsed<any>(
      `/hotlap_events${compactQuery({
        past: params?.past,
        current: params?.current,
        future: params?.future,
        order: params?.order
      })}`
    );
    return asArray(obj?.hotlap_events?.hotlap_event)
      .map(normalizeHotlapSummary)
      .filter(Boolean) as VmsHotlapEventSummary[];
  }

  async getHotlapEvent(id: number, opts?: { invalid?: 0 | 1 }): Promise<VmsHotlapEventDetail> {
    const obj = await this.getParsed<any>(`/hotlap_events/${id}${compactQuery({ invalid: opts?.invalid })}`);
    const root = obj?.hotlap_events ?? obj?.hotlap_event ?? obj;
    const eventRaw = Array.isArray(root?.hotlap_event) ? root.hotlap_event[0] : root?.hotlap_event ?? root;
    const event = normalizeHotlapSummary(eventRaw);
    const subEvents = asArray(root?.sub_event).map(normalizeSubEvent).filter(Boolean) as VmsHotlapSubEvent[];
    return { event, subEvents };
  }

  async createHotlapEvent(input: VmsHotlapEventInput): Promise<VmsHotlapEventDetail> {
    const createdXml = await this.request('/hotlap_events', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      body: buildHotlapEventXml(input)
    });
    const obj = parseXml<any>(createdXml);
    const root = obj?.hotlap_events ?? obj?.hotlap_event ?? obj;
    const eventRaw = Array.isArray(root?.hotlap_event) ? root.hotlap_event[0] : root?.hotlap_event ?? root;
    const event = normalizeHotlapSummary(eventRaw);
    const subEvents = asArray(root?.sub_event).map(normalizeSubEvent).filter(Boolean) as VmsHotlapSubEvent[];
    return { event, subEvents };
  }

  async updateHotlapEvent(id: number, input: VmsHotlapEventInput): Promise<VmsHotlapEventDetail> {
    const updatedXml = await this.request(`/hotlap_events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      body: buildHotlapEventUpdateXml(input)
    });
    const obj = parseXml<any>(updatedXml);
    const root = obj?.hotlap_events ?? obj?.hotlap_event ?? obj;
    const eventRaw = Array.isArray(root?.hotlap_event) ? root.hotlap_event[0] : root?.hotlap_event ?? root;
    const event = normalizeHotlapSummary(eventRaw);
    const subEvents = asArray(root?.sub_event).map(normalizeSubEvent).filter(Boolean) as VmsHotlapSubEvent[];
    return { event, subEvents };
  }

  async deleteHotlapEvent(id: number): Promise<void> {
    await this.request(`/hotlap_events/${id}`, { method: 'DELETE' });
  }
}
