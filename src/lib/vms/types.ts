export type VmsBooking = {
  id: number;
  eventName?: string | null;
  customerId?: number | null;
  startDate?: string;
  endDate?: string;
  status?: string;
  venueId?: number | null;
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


