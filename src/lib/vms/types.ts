export type VmsBooking = {
  id: number;
  eventName?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  startDate?: string;
  endDate?: string;
  status?: string;
  venueId?: number | null;
  venueName?: string | null;
  eventActivity?: string | null;
  groupSize?: number | null;
  numberOfPods?: number | null;
  specificPods?: string | null;
  paymentNotes?: string | null;
  notes?: string | null;
};

export type VmsLap = {
  id: number;
  customerId?: number | null;
  customerName?: string | null;
  timeMs?: number | null;
  timeStr?: string | null;
  circuitId?: number | null;
  circuit?: string | null;
  vehicleId?: number | null;
  vehicle?: string | null;
  date?: string | null;
  invalid?: number | null;
  verified?: number | null;
};

export type VmsCircuit = {
  id: number;
  name: string;
  length?: number | null;
};

export type VmsVehicle = {
  id: number;
  name: string;
  engine?: string | null;
};

export type VmsClass = {
  id: number;
  name: string;
  shortName?: string | null;
  icon?: string | null;
};

export type VmsVenue = {
  id: number;
  name: string;
};

export type VmsCatalog = {
  circuits: VmsCircuit[];
  vehicles: VmsVehicle[];
  classes: VmsClass[];
  venues: VmsVenue[];
};

export type VmsCustomerProfile = {
  id: number;
  name: string;
  tel: string | null;
  cell: string | null;
  email: string | null;
  emailOptin: boolean | null;
  postalCode: string | null;
  homeVenue: string | null;
  className: string | null;
  classId: number | null;
  memberships: string[];
  lapsRecorded: number | null;
  lastVisit: string | null;
  lastVehicle: string | null;
  lastCircuit: string | null;
  lastGroupEvent: string | null;
  lastRaceEvent: string | null;
  customerUri: string | null;
  venueUri: string | null;
  classUri: string | null;
  lapTimesUri: string | null;
  vehicleUri: string | null;
  circuitUri: string | null;
  raceEventUri: string | null;
};

export type VmsCustomerUpdateInput = {
  name?: string;
  email?: string | null;
};

export type VmsCustomerCreateInput = {
  name: string;
  email?: string | null;
  homeVenueId: number;
  classId?: number | null;
  emailOptin?: boolean | null;
  source?: string | null;
  sourceOther?: string | null;
  ifDuplicateEmailMakeSecondary?: boolean | null;
};

export type VmsBookingInput = {
  eventName: string;
  customerId: number;
  startDate: string;
  endDate: string;
  status: 'Booked' | 'Holding' | 'Cancelled';
  venueId: number;
  eventActivity?: string | null;
  groupSize?: number | null;
  numberOfPods?: number | null;
  specificPods?: string | null;
  requestedVehicleIds?: number[];
  requestedCircuitIds?: number[];
  participantIds?: number[];
  staffingNotes?: string | null;
  notes?: string | null;
  paymentNotes?: string | null;
};

export type VmsHotlapSubEventInput = {
  id?: number | null;
  name: string;
  vehicleIds?: number[];
  classIds?: number[];
};

export type VmsHotlapEventInput = {
  name: string;
  startDate: string;
  endDate: string;
  venueIds: number[];
  circuitId: number;
  qualificationPercentage?: number | null;
  subEvents: VmsHotlapSubEventInput[];
};

export type VmsHotlapEventSummary = {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  qualificationPercentage?: number | null;
  circuitId?: number | null;
  circuitName?: string | null;
};

export type VmsHotlapLeaderboardRow = {
  rank: number;
  date: string | null;
  customerId: number | null;
  customerName: string | null;
  lapId: number | null;
  lapTimeMs: number | null;
  lapTimeStr: string | null;
  transmission: string | null;
  vehicleId: number | null;
  vehicleName: string | null;
  vehicleEngine: string | null;
  classId: number | null;
  className: string | null;
  classIcon: string | null;
  venueId: number | null;
  venueName: string | null;
  invalid: number | null;
  verified: number | null;
  telemetryUri: string | null;
};

export type VmsHotlapSubEvent = {
  id: number | null;
  name: string;
  circuitId: number | null;
  circuitName: string | null;
  circuitLength: number | null;
  results: VmsHotlapLeaderboardRow[];
};

export type VmsHotlapEventDetail = {
  event: VmsHotlapEventSummary | null;
  subEvents: VmsHotlapSubEvent[];
};

export type LocalHotlapEvent = {
  id: string;
  vms_hotlap_event_id: number;
  slug: string;
  name: string;
  circuit_id: number;
  start_date: string;
  end_date: string;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
