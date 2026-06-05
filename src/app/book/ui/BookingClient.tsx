'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid2';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

type Slot = {
  startsAt: string;
  endsAt: string;
  time: string;
  available: boolean;
  availableSims: number;
  reason: 'available' | 'closed' | 'full' | 'blackout' | 'past';
};

type Availability = {
  amountCents: number;
  totalSims: number;
  slots: Slot[];
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function disabledLabel(slot: Slot) {
  if (slot.reason === 'full') return 'Full';
  if (slot.reason === 'blackout') return 'Closed';
  if (slot.reason === 'past') return 'Past';
  if (slot.reason === 'closed') return 'Unavailable';
  return `${slot.availableSims} open`;
}

function PaymentForm({
  paymentIntentId,
  onConfirmed,
  onError
}: {
  paymentIntentId: string;
  onConfirmed: (booking: any) => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    onError('');
    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required'
    });

    if (result.error) {
      setSubmitting(false);
      onError(result.error.message ?? 'Payment failed.');
      return;
    }

    const res = await fetch('/api/bookings/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentIntentId })
    });
    const json = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok) {
      onError(json?.error ?? 'Payment succeeded, but booking confirmation failed.');
      return;
    }
    onConfirmed(json.booking);
  }

  return (
    <Stack spacing={2}>
      <PaymentElement />
      <Button variant="contained" size="large" disabled={!stripe || !elements || submitting} onClick={submit}>
        {submitting ? 'Confirming...' : 'Pay and Confirm Booking'}
      </Button>
    </Stack>
  );
}

export function BookingClient({ stripePublishableKey }: { stripePublishableKey: string }) {
  const stripePromise = useMemo(() => (stripePublishableKey ? loadStripe(stripePublishableKey) : null), [stripePublishableKey]);
  const [date, setDate] = useState(todayDate());
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [simCount, setSimCount] = useState(1);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [startingPayment, setStartingPayment] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setAvailability(null);
      setSelectedSlot(null);
      setClientSecret('');
      setPaymentIntentId('');
      try {
        const params = new URLSearchParams({
          date,
          durationMinutes: String(durationMinutes),
          simCount: String(simCount)
        });
        const res = await fetch(`/api/bookings/availability?${params}`);
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? 'Failed to load availability.');
        if (!cancelled) setAvailability(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load availability.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [date, durationMinutes, simCount]);

  async function startPayment() {
    if (!selectedSlot) return;
    setStartingPayment(true);
    setError('');
    setClientSecret('');
    setPaymentIntentId('');
    try {
      const holdRes = await fetch('/api/bookings/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerEmail,
          startsAt: selectedSlot.startsAt,
          durationMinutes,
          simCount
        })
      });
      const holdJson = await holdRes.json().catch(() => null);
      if (!holdRes.ok) throw new Error(holdJson?.error ?? 'Failed to hold that booking time.');

      const payRes = await fetch('/api/bookings/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId: holdJson.hold.id })
      });
      const payJson = await payRes.json().catch(() => null);
      if (!payRes.ok) throw new Error(payJson?.error ?? 'Failed to start payment.');
      setClientSecret(payJson.clientSecret);
      setPaymentIntentId(payJson.paymentIntentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start payment.');
    } finally {
      setStartingPayment(false);
    }
  }

  const canStartPayment = Boolean(selectedSlot && customerName.trim().length >= 3 && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(customerEmail));

  if (booking) {
    return (
      <Card variant="outlined" sx={{ borderColor: 'rgba(255,210,0,0.45)' }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Chip label={booking.status === 'confirmed' ? 'Booked' : booking.status} color={booking.status === 'confirmed' ? 'success' : 'warning'} />
            <Typography variant="h5" sx={{ fontWeight: 950 }}>
              Your race is on the schedule.
            </Typography>
            <Typography color="text.secondary">
              {new Date(booking.starts_at).toLocaleString()} for {booking.sim_count} sim{booking.sim_count === 1 ? '' : 's'}.
            </Typography>
            {booking.vms_booking_id ? <Typography>VMS booking #{booking.vms_booking_id}</Typography> : null}
            {booking.error ? <Alert severity="warning">{booking.error}</Alert> : null}
            <Button href="/dashboard" variant="outlined">
              View Portal
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          <CardContent>
            <Stack spacing={2.5}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <ToggleButtonGroup
                    value={durationMinutes}
                    exclusive
                    fullWidth
                    onChange={(_e, value) => value && setDurationMinutes(value)}
                  >
                    <ToggleButton value={15}>15 min</ToggleButton>
                    <ToggleButton value={30}>30 min</ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField select label="Racers" value={simCount} onChange={(e) => setSimCount(Number(e.target.value))} fullWidth>
                    {[1, 2, 3, 4].map((count) => (
                      <MenuItem key={count} value={count}>
                        {count}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 950 }}>Available Times</Typography>
                  {availability ? <Chip size="small" label={`${availability.totalSims} sims`} /> : null}
                </Stack>
                {loading ? (
                  <CircularProgress size={24} />
                ) : availability?.slots.length ? (
                  <Grid container spacing={1}>
                    {availability.slots.map((slot) => (
                      <Grid key={slot.startsAt} size={{ xs: 6, sm: 4, md: 3 }}>
                        <Button
                          fullWidth
                          variant={selectedSlot?.startsAt === slot.startsAt ? 'contained' : 'outlined'}
                          disabled={!slot.available}
                          onClick={() => setSelectedSlot(slot)}
                          sx={{
                            minHeight: 68,
                            flexDirection: 'column',
                            borderColor: slot.available ? undefined : 'rgba(255,255,255,0.14)'
                          }}
                        >
                          <span>{slot.time}</span>
                          <Typography component="span" sx={{ fontSize: 11, opacity: 0.75 }}>
                            {disabledLabel(slot)}
                          </Typography>
                        </Button>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Alert severity="info">No public booking hours are configured for this date yet.</Alert>
                )}
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card variant="outlined" sx={{ borderColor: 'rgba(255,210,0,0.35)', position: 'sticky', top: 96 }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5" sx={{ fontWeight: 950 }}>
                Checkout
              </Typography>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <Stack spacing={0.5}>
                <Typography color="text.secondary">Session</Typography>
                <Typography sx={{ fontWeight: 900 }}>
                  {simCount} x {durationMinutes} min race - {availability ? money(availability.amountCents) : '--'}
                </Typography>
                <Typography color="text.secondary">{selectedSlot ? `${date} at ${selectedSlot.time}` : 'Choose a time slot'}</Typography>
              </Stack>
              <TextField label="Driver name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} fullWidth />
              <TextField label="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} fullWidth />
              {!clientSecret ? (
                <Button
                  variant="contained"
                  size="large"
                  disabled={!canStartPayment || startingPayment || !stripePublishableKey}
                  onClick={startPayment}
                >
                  {startingPayment ? 'Holding slot...' : 'Continue to Payment'}
                </Button>
              ) : stripePromise ? (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                  <PaymentForm paymentIntentId={paymentIntentId} onConfirmed={setBooking} onError={setError} />
                </Elements>
              ) : null}
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                Online cancellations are refundable until 2 hours before race time.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
