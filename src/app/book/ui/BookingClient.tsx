'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  CUSTOM_DURATION_BLOCK_MINUTES,
  CUSTOM_DURATION_BLOCK_PRICE_CENTS,
  MAX_CUSTOM_DURATION_MINUTES,
  MIN_CUSTOM_DURATION_MINUTES,
  bookingAmountCents,
  supportedBookingDuration
} from '@/lib/bookings/config';

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

type MembershipSummary = {
  status: 'inactive' | 'active-start' | 'active';
  freeRaceAvailable: boolean;
  discountPercent: number;
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function bookingPrice(durationMinutes: number, simCount: number) {
  return bookingAmountCents(durationMinutes, simCount) ?? 0;
}

function memberBookingPrice(durationMinutes: number, simCount: number, membership: MembershipSummary | null) {
  const base = bookingPrice(durationMinutes, simCount);
  if (!membership || membership.status === 'inactive') return { amountCents: base, discountCents: 0, freeRaceApplied: false };

  const freeRaceApplied = membership.freeRaceAvailable && simCount > 0;
  const oneDriverPrice = bookingPrice(durationMinutes, 1);
  const freeCredit = freeRaceApplied ? Math.min(oneDriverPrice, CUSTOM_DURATION_BLOCK_PRICE_CENTS) : 0;
  const discountable = Math.max(0, base - freeCredit);
  const discount = Math.round(discountable * (membership.discountPercent / 100));
  return {
    amountCents: Math.max(0, discountable - discount),
    discountCents: freeCredit + discount,
    freeRaceApplied
  };
}

function formatSlotTime(time: string) {
  const [hourRaw, minute = '00'] = time.split(':');
  const hour = Number(hourRaw);
  if (!Number.isFinite(hour)) return time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function addMinutesToSlotTime(time: string, minutesToAdd: number) {
  const [hourRaw, minuteRaw = '00'] = time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  const totalMinutes = (hour * 60 + minute + minutesToAdd) % (24 * 60);
  const nextHour = Math.floor(totalMinutes / 60);
  const nextMinute = totalMinutes % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
}

function slotEndTime(slot: Slot, durationMinutes: number) {
  return formatSlotTime(addMinutesToSlotTime(slot.time, durationMinutes));
}

function slotSubtitle(slot: Slot, durationMinutes: number) {
  if (!slot.available) {
    if (durationMinutes > 15 && slot.reason !== 'past') return 'Unavailable';
    return disabledLabel(slot);
  }
  if (durationMinutes > 15) return `until ${slotEndTime(slot, durationMinutes)} · ${slot.availableSims} open`;
  return `${slot.availableSims} open`;
}

function slotRangeLabel(slot: Slot, durationMinutes: number) {
  const start = formatSlotTime(slot.time);
  if (durationMinutes === 15) return start;
  return `${start} - ${slotEndTime(slot, durationMinutes)}`;
}

function durationModeFor(durationMinutes: number): '15' | '25' | 'custom' {
  if (durationMinutes === 15) return '15';
  if (durationMinutes === 25) return '25';
  return 'custom';
}

function isSlotInsideSelectedWindow(slot: Slot, selectedSlot: Slot | null, durationMinutes: number) {
  if (!selectedSlot) return false;
  const slotStart = new Date(slot.startsAt).getTime();
  const windowStart = new Date(selectedSlot.startsAt).getTime();
  const windowEnd = windowStart + durationMinutes * 60_000;
  return slotStart >= windowStart && slotStart < windowEnd;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
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
  const [ready, setReady] = useState(false);

  async function submit() {
    if (!stripe || !elements) return;
    const paymentElement = elements.getElement(PaymentElement);
    if (!paymentElement || !ready) {
      onError('Payment fields are still loading. Give them a second and try again.');
      return;
    }
    setSubmitting(true);
    onError('');

    let result;
    try {
      result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/book`
        }
      });
    } catch (error) {
      setSubmitting(false);
      onError(error instanceof Error ? error.message : 'Stripe could not confirm the payment.');
      return;
    }

    if (result.error) {
      setSubmitting(false);
      onError(result.error.message ?? 'Payment failed.');
      return;
    }

    const confirmedPaymentIntentId = result.paymentIntent?.id ?? paymentIntentId;
    if (result.paymentIntent && result.paymentIntent.status !== 'succeeded') {
      setSubmitting(false);
      onError(`Payment is ${result.paymentIntent.status}. Try again in a moment or use another card.`);
      return;
    }

    const res = await fetch('/api/bookings/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentIntentId: confirmedPaymentIntentId })
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
      {!ready ? <Alert severity="info">Loading secure card fields...</Alert> : null}
      <PaymentElement onReady={() => setReady(true)} onLoadError={(event) => onError(event.error?.message ?? 'Stripe payment form failed to load.')} />
      <Button variant="contained" size="large" disabled={!stripe || !elements || submitting || !ready} onClick={submit}>
        {submitting ? 'Confirming...' : 'Pay and Confirm Booking'}
      </Button>
    </Stack>
  );
}

export function BookingClient({
  stripePublishableKey,
  initialDurationMinutes = 15
}: {
  stripePublishableKey: string;
  initialDurationMinutes?: number;
}) {
  const stripePromise = useMemo(() => (stripePublishableKey ? loadStripe(stripePublishableKey) : null), [stripePublishableKey]);
  const [date, setDate] = useState(todayDate());
  const [durationMinutes, setDurationMinutes] = useState(initialDurationMinutes);
  const [durationMode, setDurationMode] = useState<'15' | '25' | 'custom'>(() => durationModeFor(initialDurationMinutes));
  const [customDurationMinutes, setCustomDurationMinutes] = useState(() =>
    String(durationModeFor(initialDurationMinutes) === 'custom' ? initialDurationMinutes : 45)
  );
  const [simCount, setSimCount] = useState(1);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [startingPayment, setStartingPayment] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadCustomer() {
      const res = await fetch('/api/bookings/current-customer');
      const json = await res.json().catch(() => null);
      if (cancelled || !res.ok || !json) return;
      const name = json.user?.name || json.customer?.name || '';
      const email = json.user?.email || json.customer?.email || '';
      if (name) setCustomerName(name);
      if (email) setCustomerEmail(email);
      if (json.membership) setMembership(json.membership);
    }
    void loadCustomer();
    return () => {
      cancelled = true;
    };
  }, []);

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
          simCount: '1'
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
  }, [date, durationMinutes]);

  useEffect(() => {
    if (selectedSlot && simCount > selectedSlot.availableSims) setSimCount(Math.max(1, selectedSlot.availableSims));
  }, [selectedSlot, simCount]);

  function resetPaymentState() {
    setSelectedSlot(null);
    setClientSecret('');
    setPaymentIntentId('');
    setError('');
  }

  function applyDuration(value: number | null) {
    if (!value || value === durationMinutes) return;
    resetPaymentState();
    setDurationMinutes(value);
  }

  function changeDurationMode(value: '15' | '25' | 'custom' | null) {
    if (!value) return;
    setDurationMode(value);
    if (value === '15') applyDuration(15);
    if (value === '25') applyDuration(25);
    if (value === 'custom') {
      const parsed = Number(customDurationMinutes);
      applyDuration(supportedBookingDuration(parsed) ? parsed : 45);
    }
  }

  function changeCustomDuration(value: string) {
    setCustomDurationMinutes(value);
    const parsed = Number(value);
    if (supportedBookingDuration(parsed)) applyDuration(parsed);
  }

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
          customerPhone,
          smsConsent,
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
      if (payJson?.freeBooking && payJson.booking) {
        setBooking(payJson.booking);
        return;
      }
      setClientSecret(payJson.clientSecret);
      setPaymentIntentId(payJson.paymentIntentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start payment.');
    } finally {
      setStartingPayment(false);
    }
  }

  const baseAmountCents = bookingPrice(durationMinutes, simCount);
  const memberPrice = memberBookingPrice(durationMinutes, simCount, membership);
  const amountCents = memberPrice.amountCents;
  const canStartPayment = Boolean(
    selectedSlot &&
      simCount >= 1 &&
      simCount <= selectedSlot.availableSims &&
      customerName.trim().length >= 3 &&
      /[^\s@]+@[^\s@]+\.[^\s@]+/.test(customerEmail) &&
      customerPhone.replace(/\D/g, '').length >= 10 &&
      smsConsent
  );

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
              {formatDateTime(booking.starts_at)} for {booking.sim_count} sim{booking.sim_count === 1 ? '' : 's'}.
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
                  <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={Boolean(clientSecret)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 7 }}>
                  <ToggleButtonGroup
                    value={durationMode}
                    exclusive
                    fullWidth
                    disabled={Boolean(clientSecret)}
                    onChange={(_e, value) => changeDurationMode(value)}
                  >
                    <ToggleButton value="15">15 min</ToggleButton>
                    <ToggleButton value="25">25 min</ToggleButton>
                    <ToggleButton value="custom">Custom</ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                {durationMode === 'custom' ? (
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Custom minutes"
                      type="number"
                      value={customDurationMinutes}
                      onChange={(e) => changeCustomDuration(e.target.value)}
                      disabled={Boolean(clientSecret)}
                      fullWidth
                      inputProps={{ min: MIN_CUSTOM_DURATION_MINUTES, max: MAX_CUSTOM_DURATION_MINUTES, step: 5 }}
                      helperText={`Custom races are ${money(CUSTOM_DURATION_BLOCK_PRICE_CENTS)} per started ${CUSTOM_DURATION_BLOCK_MINUTES}-minute block, per racer.`}
                      error={customDurationMinutes.trim().length > 0 && !supportedBookingDuration(Number(customDurationMinutes))}
                    />
                  </Grid>
                ) : null}
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
                    {availability.slots.map((slot) => {
                      const isStartSelected = selectedSlot?.startsAt === slot.startsAt;
                      const isWindowSelected = isSlotInsideSelectedWindow(slot, selectedSlot, durationMinutes);
                      const isWindowContinuation = isWindowSelected && !isStartSelected;
                      const subtitle = durationMinutes > 15 && isWindowSelected ? 'selected window' : slotSubtitle(slot, durationMinutes);
                      return (
                        <Grid key={slot.startsAt} size={{ xs: 6, sm: 4, md: 3 }}>
                          <Button
                            fullWidth
                            variant={isWindowSelected ? 'contained' : 'outlined'}
                            disabled={!slot.available || Boolean(clientSecret) || isWindowContinuation}
                            onClick={() => setSelectedSlot(slot)}
                            sx={{
                              minHeight: 78,
                              flexDirection: 'column',
                              borderColor: isWindowSelected ? 'rgba(255,210,0,0.92)' : slot.available ? undefined : 'rgba(255,255,255,0.14)',
                              bgcolor: isWindowSelected ? 'rgba(255,210,0,0.92)' : undefined,
                              color: isWindowSelected ? '#050505' : undefined,
                              opacity: isWindowContinuation ? 0.86 : undefined,
                              boxShadow: isWindowSelected ? '0 0 0 1px rgba(255,210,0,0.9), 0 0 24px rgba(255,210,0,0.18)' : undefined,
                              '&:hover': isWindowSelected
                                ? {
                                    bgcolor: '#FFD200',
                                    borderColor: '#FFD200'
                                  }
                                : undefined,
                              '&.Mui-disabled': {
                                color: isWindowContinuation ? '#050505' : 'rgba(255,255,255,0.45)',
                                bgcolor: isWindowContinuation ? 'rgba(255,210,0,0.82)' : 'rgba(255,22,31,0.72)',
                                borderColor: isWindowContinuation ? 'rgba(255,210,0,0.82)' : 'rgba(255,255,255,0.12)'
                              }
                            }}
                          >
                            <span>{formatSlotTime(slot.time)}</span>
                            <Typography component="span" sx={{ fontSize: 11, opacity: 0.75, textAlign: 'center' }}>
                              {subtitle}
                            </Typography>
                          </Button>
                        </Grid>
                      );
                    })}
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
                  {simCount} x {durationMinutes} min race - {money(amountCents)}
                </Typography>
                {memberPrice.discountCents > 0 ? (
                  <Typography color="primary" sx={{ fontSize: 13, fontWeight: 800 }}>
                    Member savings: {money(memberPrice.discountCents)}
                    {memberPrice.freeRaceApplied ? ' including this month’s free race' : ''}
                  </Typography>
                ) : null}
                {memberPrice.discountCents > 0 && baseAmountCents !== amountCents ? (
                  <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                    Standard price: {money(baseAmountCents)}
                  </Typography>
                ) : null}
                <Typography color="text.secondary">{selectedSlot ? `${date} at ${slotRangeLabel(selectedSlot, durationMinutes)}` : 'Choose a time slot'}</Typography>
              </Stack>
              <Box>
                <Typography color="text.secondary" sx={{ mb: 1 }}>
                  Racers / sims
                </Typography>
                <Grid container spacing={1}>
                  {[1, 2, 3, 4].map((count) => {
                    const enabled = Boolean(selectedSlot && count <= selectedSlot.availableSims);
                    const selected = count <= simCount;
                    return (
                      <Grid key={count} size={{ xs: 6, sm: 3 }}>
                        <Button
                          fullWidth
                          disabled={!enabled || Boolean(clientSecret)}
                          variant={selected ? 'contained' : 'outlined'}
                          onClick={() => setSimCount(count)}
                          sx={{ minHeight: 58, flexDirection: 'column' }}
                        >
                          {count} racer{count === 1 ? '' : 's'}
                          <Typography component="span" sx={{ fontSize: 11, opacity: 0.7 }}>
                            {enabled ? 'Available' : 'Unavailable'}
                          </Typography>
                        </Button>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
              <TextField label="Full name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={Boolean(clientSecret)} fullWidth />
              <TextField label="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} disabled={Boolean(clientSecret)} fullWidth />
              <TextField
                label="Mobile phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={Boolean(clientSecret)}
                fullWidth
                helperText="Used for a 3-minute race reminder text."
              />
              <FormControlLabel
                control={<Checkbox checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} disabled={Boolean(clientSecret)} />}
                label="Text me a reminder 3 minutes before my race."
              />
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
                <Stack spacing={1.5}>
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                    <PaymentForm paymentIntentId={paymentIntentId} onConfirmed={setBooking} onError={setError} />
                  </Elements>
                  <Button
                    variant="text"
                    onClick={() => {
                      setClientSecret('');
                      setPaymentIntentId('');
                    }}
                  >
                    Change booking details
                  </Button>
                </Stack>
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
