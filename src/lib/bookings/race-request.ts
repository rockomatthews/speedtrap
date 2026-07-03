import { localDateTimeToUtc } from '@/lib/bookings/time';
import { VmsClient } from '@/lib/vms/client';
import { type VmsHotlapEventSummary } from '@/lib/vms/types';

export type RaceRequestInput =
  | { type: 'none' }
  | { type: 'vehicle_circuit'; vehicleId: number; circuitId: number }
  | { type: 'hotlap_event'; eventId: number };

export type ValidatedRaceRequest = {
  raceRequestType: 'none' | 'vehicle_circuit' | 'hotlap_event';
  requestedVehicleId: number | null;
  requestedVehicleName: string | null;
  requestedCircuitId: number | null;
  requestedCircuitName: string | null;
  requestedHotlapEventId: number | null;
  requestedHotlapEventName: string | null;
};

const EMPTY_RACE_REQUEST: ValidatedRaceRequest = {
  raceRequestType: 'none',
  requestedVehicleId: null,
  requestedVehicleName: null,
  requestedCircuitId: null,
  requestedCircuitName: null,
  requestedHotlapEventId: null,
  requestedHotlapEventName: null
};

function parseVmsLocalDateTime(value: string | null | undefined, endOfDay = false) {
  if (!value) return null;
  const normalized = value.replace('T', ' ').trim();
  const [date, rawTime] = normalized.split(/\s+/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = rawTime ? (rawTime.length === 5 ? `${rawTime}:00` : rawTime) : endOfDay ? '23:59:59' : '00:00:00';
  return localDateTimeToUtc(date, time);
}

export function isHotlapEventActiveAt(event: VmsHotlapEventSummary, startsAt: Date) {
  const start = parseVmsLocalDateTime(event.startDate);
  const end = parseVmsLocalDateTime(event.endDate, true);
  if (!start || !end) return false;
  return startsAt >= start && startsAt <= end;
}

export function raceRequestDbFields(request: ValidatedRaceRequest) {
  return {
    race_request_type: request.raceRequestType,
    requested_vehicle_id: request.requestedVehicleId,
    requested_vehicle_name: request.requestedVehicleName,
    requested_circuit_id: request.requestedCircuitId,
    requested_circuit_name: request.requestedCircuitName,
    requested_hotlap_event_id: request.requestedHotlapEventId,
    requested_hotlap_event_name: request.requestedHotlapEventName
  };
}

export function raceRequestLabel(row: {
  race_request_type?: string | null;
  requested_vehicle_name?: string | null;
  requested_circuit_name?: string | null;
  requested_hotlap_event_name?: string | null;
  requested_hotlap_event_id?: number | null;
}) {
  if (row.race_request_type === 'vehicle_circuit') {
    return [row.requested_vehicle_name, row.requested_circuit_name].filter(Boolean).join(' at ') || null;
  }
  if (row.race_request_type === 'hotlap_event') {
    const suffix = row.requested_hotlap_event_id ? ` #${row.requested_hotlap_event_id}` : '';
    return row.requested_hotlap_event_name ? `${row.requested_hotlap_event_name}${suffix}` : null;
  }
  return null;
}

export function raceRequestVmsFields(row: {
  race_request_type?: string | null;
  requested_vehicle_id?: number | null;
  requested_vehicle_name?: string | null;
  requested_circuit_id?: number | null;
  requested_circuit_name?: string | null;
  requested_hotlap_event_id?: number | null;
  requested_hotlap_event_name?: string | null;
}) {
  const label = raceRequestLabel(row);
  return {
    requestedVehicleIds: row.race_request_type === 'vehicle_circuit' && row.requested_vehicle_id ? [Number(row.requested_vehicle_id)] : [],
    requestedCircuitIds:
      (row.race_request_type === 'vehicle_circuit' || row.race_request_type === 'hotlap_event') && row.requested_circuit_id
        ? [Number(row.requested_circuit_id)]
        : [],
    noteLine: label ? `Race request: ${label}` : null
  };
}

export async function validateRaceRequest(input: RaceRequestInput | undefined, startsAt: Date): Promise<ValidatedRaceRequest> {
  if (!input || input.type === 'none') return EMPTY_RACE_REQUEST;

  const vms = VmsClient.fromEnv();

  if (input.type === 'vehicle_circuit') {
    const catalog = await vms.getCatalog();
    const vehicle = catalog.vehicles.find((item) => item.id === input.vehicleId);
    if (!vehicle) throw new Error('Selected vehicle is not available in VMS.');
    const circuit = catalog.circuits.find((item) => item.id === input.circuitId);
    if (!circuit) throw new Error('Selected circuit is not available in VMS.');
    return {
      raceRequestType: 'vehicle_circuit',
      requestedVehicleId: vehicle.id,
      requestedVehicleName: vehicle.name,
      requestedCircuitId: circuit.id,
      requestedCircuitName: circuit.name,
      requestedHotlapEventId: null,
      requestedHotlapEventName: null
    };
  }

  const events = await vms.listHotlapEvents({ current: 1, future: 1, order: 'dateasc' });
  const event = events.find((item) => item.id === input.eventId);
  if (!event) throw new Error('Selected hotlap event is not available in VMS.');
  if (!isHotlapEventActiveAt(event, startsAt)) throw new Error('Selected hotlap event is not active at that booking time.');
  return {
    raceRequestType: 'hotlap_event',
    requestedVehicleId: null,
    requestedVehicleName: null,
    requestedCircuitId: event.circuitId ?? null,
    requestedCircuitName: event.circuitName ?? null,
    requestedHotlapEventId: event.id,
    requestedHotlapEventName: event.name
  };
}
