'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type RaceBooking = {
  id: string;
  source: string;
  customer_name: string;
  customer_email: string;
  duration_minutes: number;
  sim_count: number;
  starts_at: string;
  ends_at: string;
  amount_cents: number;
  currency: string;
  status: string;
  vms_booking_id: number | null;
  error: string | null;
  race_request_type: string | null;
  requested_vehicle_name: string | null;
  requested_circuit_name: string | null;
  requested_hotlap_event_name: string | null;
};

function statusColor(status: string) {
  if (status === 'confirmed') return 'success';
  if (status.includes('failed')) return 'error';
  if (status === 'refunded' || status === 'cancelled') return 'default';
  return 'warning';
}

function canCancel(booking: RaceBooking) {
  return ['confirmed', 'payment_succeeded_vms_failed'].includes(booking.status) && new Date(booking.starts_at).getTime() - Date.now() >= 2 * 60 * 60 * 1000;
}

function raceRequestLabel(booking: RaceBooking) {
  if (booking.race_request_type === 'vehicle_circuit') {
    return [booking.requested_vehicle_name, booking.requested_circuit_name].filter(Boolean).join(' at ') || null;
  }
  if (booking.race_request_type === 'hotlap_event') return booking.requested_hotlap_event_name;
  return null;
}

export function RaceBookingsList() {
  const [bookings, setBookings] = useState<RaceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cancellingId, setCancellingId] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bookings/me');
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Failed to load bookings.');
      setBookings(json.bookings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function cancelBooking(booking: RaceBooking) {
    setCancellingId(booking.id);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: booking.customer_email })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Failed to cancel booking.');
      setMessage('Booking cancelled and refund started.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel booking.');
    } finally {
      setCancellingId('');
    }
  }

  if (loading) return <CircularProgress size={22} />;

  return (
    <Stack spacing={1.5}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}
      {bookings.length === 0 ? (
        <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          <CardContent>
            <Typography sx={{ fontWeight: 900 }}>No online race bookings yet</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Booked races from the public schedule will appear here.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        bookings.map((booking) => (
          <Card key={booking.id} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography sx={{ fontWeight: 900 }}>
                      {booking.sim_count} x {booking.duration_minutes} min race
                    </Typography>
                    <Chip size="small" label={booking.status} color={statusColor(booking.status) as any} />
                  </Stack>
                  <Typography color="text.secondary">
                    {new Date(booking.starts_at).toLocaleString()} ·{' '}
                    {booking.vms_booking_id ? `VMS booking #${booking.vms_booking_id}` : 'VMS sync pending'}
                  </Typography>
                  {raceRequestLabel(booking) ? (
                    <Typography color="text.secondary">Race request: {raceRequestLabel(booking)}</Typography>
                  ) : null}
                  {booking.error ? <Typography color="error.main">{booking.error}</Typography> : null}
                </Stack>
                {canCancel(booking) ? (
                  <Button color="error" disabled={cancellingId === booking.id} onClick={() => void cancelBooking(booking)}>
                    {cancellingId === booking.id ? 'Cancelling...' : 'Cancel + Refund'}
                  </Button>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}
