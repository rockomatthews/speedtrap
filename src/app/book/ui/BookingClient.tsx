'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid2';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  BOOKING_SLOT_INTERVAL_MINUTES,
  CUSTOM_DURATION_BLOCK_MINUTES,
  CUSTOM_DURATION_BLOCK_PRICE_CENTS,
  bookingAmountCents,
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

type RaceOption = {
  id: number;
  name: string;
  subtitle?: string | null;
  circuitId?: number | null;
  circuitName?: string | null;
};

type RaceRequestMode = 'none' | 'hotlap_event' | 'vehicle_circuit';

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

function slotSubtitle(slot: Slot, durationMinutes: number, availableSims?: number) {
  if (!slot.available) {
    if (durationMinutes > 15 && slot.reason !== 'past') return 'Unavailable';
    return disabledLabel(slot);
  }
  const sims = availableSims ?? slot.availableSims;
  if (durationMinutes > 15) return `until ${slotEndTime(slot, durationMinutes)} · ${sims} open`;
  return `${sims} open`;
}

function slotRangeLabel(slot: Slot, durationMinutes: number) {
  const start = formatSlotTime(slot.time);
  if (durationMinutes === 15) return start;
  return `${start} - ${slotEndTime(slot, durationMinutes)}`;
}

function durationModeFor(durationMinutes: number): '15' | '30' {
  return durationMinutes === 30 ? '30' : '15';
}

function isSlotInsideSelectedWindow(slot: Slot, selectedSlot: Slot | null, durationMinutes: number) {
  if (!selectedSlot) return false;
  const slotStart = new Date(slot.startsAt).getTime();
  const windowStart = new Date(selectedSlot.startsAt).getTime();
  const windowEnd = windowStart + durationMinutes * 60_000;
  return slotStart >= windowStart && slotStart < windowEnd;
}

function availableSimsForWindow(slots: Slot[], startsAt: string, durationMinutes: number) {
  const startMs = new Date(startsAt).getTime();
  if (!Number.isFinite(startMs)) return 0;

  const expectedCells = Math.ceil(durationMinutes / BOOKING_SLOT_INTERVAL_MINUTES);
  let availableSims = Number.POSITIVE_INFINITY;

  for (let index = 0; index < expectedCells; index += 1) {
    const cellStart = new Date(startMs + index * BOOKING_SLOT_INTERVAL_MINUTES * 60_000).toISOString();
    const cell = slots.find((slot) => slot.startsAt === cellStart);
    if (!cell?.available) return 0;
    availableSims = Math.min(availableSims, cell.availableSims);
  }

  return Number.isFinite(availableSims) ? availableSims : 0;
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

function raceRequestSummary(booking: any) {
  if (booking?.race_request_type === 'vehicle_circuit') {
    return [booking.requested_vehicle_name, booking.requested_circuit_name].filter(Boolean).join(' at ') || null;
  }
  if (booking?.race_request_type === 'hotlap_event') return booking.requested_hotlap_event_name ?? null;
  return null;
}

function RaceOptionAutocomplete({
  type,
  label,
  value,
  onChange,
  disabled,
  startsAt,
  helperText
}: {
  type: 'vehicle' | 'circuit';
  label: string;
  value: RaceOption | null;
  onChange: (option: RaceOption | null) => void;
  disabled?: boolean;
  startsAt?: string;
  helperText?: string;
}) {
  const [inputValue, setInputValue] = useState(value?.name ?? '');
  const [options, setOptions] = useState<RaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setInputValue(value?.name ?? '');
  }, [value]);

  useEffect(() => {
    if (disabled || inputValue.trim().length < 2) {
      setOptions([]);
      setLoading(false);
      setError('');
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ type, q: inputValue.trim() });
        if (startsAt) params.set('startsAt', startsAt);
        const res = await fetch(`/api/bookings/race-options?${params}`);
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? 'VMS options are not available.');
        if (!cancelled) setOptions(json.options ?? []);
      } catch (e) {
        if (!cancelled) {
          setOptions([]);
          setError(e instanceof Error ? e.message : 'VMS options are not available.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [disabled, inputValue, startsAt, type]);

  return (
    <Autocomplete
      value={value}
      inputValue={inputValue}
      options={options}
      loading={loading}
      disabled={disabled}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      getOptionLabel={(option) => option.name}
      noOptionsText={inputValue.trim().length < 2 ? 'Type at least 2 characters' : 'No VMS matches'}
      onInputChange={(_event, nextValue) => setInputValue(nextValue)}
      onChange={(_event, nextValue) => onChange(nextValue)}
      onBlur={() => {
        if (!value || inputValue.trim() !== value.name) {
          onChange(null);
          setInputValue('');
        }
      }}
      renderOption={(props, option) => (
        <Box component="li" {...props}>
          <Stack spacing={0}>
            <Typography sx={{ fontWeight: 800 }}>{option.name}</Typography>
            {option.subtitle ? (
              <Typography variant="caption" color="text.secondary">
                {option.subtitle}
              </Typography>
            ) : null}
          </Stack>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={error || helperText}
          error={Boolean(error)}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            )
          }}
        />
      )}
    />
  );
}

function LiveEventSelect({
  label,
  value,
  onChange,
  disabled,
  startsAt,
  helperText
}: {
  label: string;
  value: RaceOption | null;
  onChange: (option: RaceOption | null) => void;
  disabled?: boolean;
  startsAt?: string;
  helperText?: string;
}) {
  const [options, setOptions] = useState<RaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (disabled || !startsAt) {
      setOptions([]);
      setLoading(false);
      setError('');
      return;
    }

    const eventStartsAt = startsAt;
    let cancelled = false;
    async function loadEvents() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ type: 'event', startsAt: eventStartsAt });
        const res = await fetch(`/api/bookings/race-options?${params}`);
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? 'Live events are not available.');
        if (!cancelled) setOptions(json.options ?? []);
      } catch (e) {
        if (!cancelled) {
          setOptions([]);
          setError(e instanceof Error ? e.message : 'Live events are not available.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [disabled, startsAt]);

  useEffect(() => {
    if (value && options.length > 0 && !options.some((option) => option.id === value.id)) {
      onChange(null);
    }
  }, [onChange, options, value]);

  const selectedValue = value ? String(value.id) : '';
  const emptyText = startsAt ? 'No live events are available for this booking time.' : 'Choose a time before selecting an event.';

  return (
    <TextField
      select
      fullWidth
      label={label}
      value={selectedValue}
      disabled={disabled || loading || !startsAt}
      error={Boolean(error)}
      helperText={error || (loading ? 'Loading live events...' : options.length === 0 ? emptyText : helperText)}
      onChange={(event) => {
        const next = options.find((option) => String(option.id) === event.target.value) ?? null;
        onChange(next);
      }}
    >
      <MenuItem value="">Choose live event</MenuItem>
      {options.map((option) => (
        <MenuItem key={option.id} value={String(option.id)}>
          <Stack spacing={0}>
            <Typography sx={{ fontWeight: 800 }}>{option.name}</Typography>
            {option.subtitle ? (
              <Typography variant="caption" color="text.secondary">
                {option.subtitle}
              </Typography>
            ) : null}
          </Stack>
        </MenuItem>
      ))}
    </TextField>
  );
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
  const initialBaseDurationMinutes: 15 | 30 = initialDurationMinutes === 30 ? 30 : 15;
  const stripePromise = useMemo(() => (stripePublishableKey ? loadStripe(stripePublishableKey) : null), [stripePublishableKey]);
  const [date, setDate] = useState(todayDate());
  const [baseDurationMinutes, setBaseDurationMinutes] = useState<15 | 30>(initialBaseDurationMinutes);
  const [extraBlockCount, setExtraBlockCount] = useState(0);
  const [durationMode, setDurationMode] = useState<'15' | '30'>(() => durationModeFor(initialBaseDurationMinutes));
  const [simCount, setSimCount] = useState(1);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [raceRequestMode, setRaceRequestMode] = useState<RaceRequestMode>('none');
  const [selectedVehicle, setSelectedVehicle] = useState<RaceOption | null>(null);
  const [selectedCircuit, setSelectedCircuit] = useState<RaceOption | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<RaceOption | null>(null);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [startingPayment, setStartingPayment] = useState(false);
  const [error, setError] = useState('');
  const durationMinutes = selectedSlot ? baseDurationMinutes + extraBlockCount * CUSTOM_DURATION_BLOCK_MINUTES : baseDurationMinutes;
  const selectedWindowAvailableSims = useMemo(() => {
    if (!availability || !selectedSlot) return 0;
    return availableSimsForWindow(availability.slots, selectedSlot.startsAt, durationMinutes);
  }, [availability, selectedSlot, durationMinutes]);

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
      setExtraBlockCount(0);
      resetRaceRequest();
      setClientSecret('');
      setPaymentIntentId('');
      try {
        const params = new URLSearchParams({
          date,
          durationMinutes: String(BOOKING_SLOT_INTERVAL_MINUTES),
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
  }, [date, baseDurationMinutes]);

  useEffect(() => {
    if (selectedSlot && selectedWindowAvailableSims > 0 && simCount > selectedWindowAvailableSims) {
      setSimCount(Math.max(1, selectedWindowAvailableSims));
    }
  }, [selectedSlot, selectedWindowAvailableSims, simCount]);

  function resetPaymentState() {
    setSelectedSlot(null);
    setExtraBlockCount(0);
    resetRaceRequest();
    setClientSecret('');
    setPaymentIntentId('');
    setError('');
  }

  function resetRaceRequest() {
    setRaceRequestMode('none');
    setSelectedVehicle(null);
    setSelectedCircuit(null);
    setSelectedEvent(null);
  }

  function applyBaseDuration(value: 15 | 30) {
    if (value === baseDurationMinutes) return;
    resetPaymentState();
    setBaseDurationMinutes(value);
  }

  function changeDurationMode(value: '15' | '30' | null) {
    if (!value) return;
    setDurationMode(value);
    if (value === '15') applyBaseDuration(15);
    if (value === '30') applyBaseDuration(30);
  }

  function resetSelectedSlot() {
    setSelectedSlot(null);
    setExtraBlockCount(0);
    resetRaceRequest();
    setClientSecret('');
    setPaymentIntentId('');
    setError('');
  }

  function selectStartSlot(slot: Slot) {
    if (!availability) return;
    const availableSims = availableSimsForWindow(availability.slots, slot.startsAt, baseDurationMinutes);
    if (availableSims < 1) return;
    setSelectedSlot(slot);
    setExtraBlockCount(0);
    setClientSecret('');
    setPaymentIntentId('');
    resetRaceRequest();
    setError('');
  }

  function toggleSlot(slot: Slot) {
    if (!availability || clientSecret) return;
    if (!selectedSlot) {
      selectStartSlot(slot);
      return;
    }

    const clickedMs = new Date(slot.startsAt).getTime();
    const startMs = new Date(selectedSlot.startsAt).getTime();
    const baseEndMs = startMs + baseDurationMinutes * 60_000;
    const selectedEndMs = startMs + durationMinutes * 60_000;

    if (!Number.isFinite(clickedMs) || !Number.isFinite(startMs)) return;

    if (clickedMs < startMs) {
      selectStartSlot(slot);
      return;
    }

    if (clickedMs < baseEndMs) {
      resetSelectedSlot();
      return;
    }

    if (clickedMs < selectedEndMs) {
      const clickedBlockIndex = Math.floor((clickedMs - baseEndMs) / (CUSTOM_DURATION_BLOCK_MINUTES * 60_000));
      setExtraBlockCount(Math.max(0, clickedBlockIndex));
      setClientSecret('');
      setPaymentIntentId('');
      resetRaceRequest();
      setError('');
      return;
    }

    const requestedExtraBlockCount = Math.floor((clickedMs - baseEndMs) / (CUSTOM_DURATION_BLOCK_MINUTES * 60_000)) + 1;
    const requestedDurationMinutes = baseDurationMinutes + requestedExtraBlockCount * CUSTOM_DURATION_BLOCK_MINUTES;
    const availableSims = availableSimsForWindow(availability.slots, selectedSlot.startsAt, requestedDurationMinutes);
    if (availableSims < 1) {
      setError('That added time is not available for the selected booking window.');
      return;
    }

    setExtraBlockCount(requestedExtraBlockCount);
    if (simCount > availableSims) setSimCount(Math.max(1, availableSims));
    setClientSecret('');
    setPaymentIntentId('');
    resetRaceRequest();
    setError('');
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
          simCount,
          raceRequest:
            raceRequestMode === 'vehicle_circuit'
              ? { type: 'vehicle_circuit', vehicleId: selectedVehicle?.id, circuitId: selectedCircuit?.id }
              : raceRequestMode === 'hotlap_event'
                ? { type: 'hotlap_event', eventId: selectedEvent?.id }
                : { type: 'none' }
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
  const raceRequestReady =
    raceRequestMode === 'none' ||
    (raceRequestMode === 'hotlap_event' && Boolean(selectedEvent)) ||
    (raceRequestMode === 'vehicle_circuit' && Boolean(selectedVehicle && selectedCircuit));
  const canStartPayment = Boolean(
    selectedSlot &&
      simCount >= 1 &&
      simCount <= selectedWindowAvailableSims &&
      customerName.trim().length >= 3 &&
      /[^\s@]+@[^\s@]+\.[^\s@]+/.test(customerEmail) &&
      customerPhone.replace(/\D/g, '').length >= 10 &&
      smsConsent &&
      raceRequestReady
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
            {raceRequestSummary(booking) ? <Typography>Race request: {raceRequestSummary(booking)}</Typography> : null}
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
                    <ToggleButton value="30">30 min</ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
              </Grid>

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 950 }}>Available Times</Typography>
                  {availability ? <Chip size="small" label={`${availability.totalSims} sims`} /> : null}
                </Stack>
                <Typography color="text.secondary" sx={{ mb: 1.5, fontSize: 13 }}>
                  Pick a start time, then tap later slots to add or remove 30-minute blocks.
                </Typography>
                {loading ? (
                  <CircularProgress size={24} />
                ) : availability?.slots.length ? (
                  <Grid container spacing={1}>
                    {availability.slots.map((slot) => {
                      const baseWindowAvailableSims = availableSimsForWindow(availability.slots, slot.startsAt, baseDurationMinutes);
                      const isStartSelected = selectedSlot?.startsAt === slot.startsAt;
                      const isWindowSelected = isSlotInsideSelectedWindow(slot, selectedSlot, durationMinutes);
                      const isBaseWindowSelected = isSlotInsideSelectedWindow(slot, selectedSlot, baseDurationMinutes);
                      let canInteract = !clientSecret && baseWindowAvailableSims > 0;
                      if (!clientSecret && selectedSlot) {
                        if (isWindowSelected) {
                          canInteract = true;
                        } else {
                          const clickedMs = new Date(slot.startsAt).getTime();
                          const startMs = new Date(selectedSlot.startsAt).getTime();
                          const baseEndMs = startMs + baseDurationMinutes * 60_000;
                          if (clickedMs < startMs) {
                            canInteract = baseWindowAvailableSims > 0;
                          } else if (clickedMs >= baseEndMs) {
                            const requestedExtraBlockCount = Math.floor((clickedMs - baseEndMs) / (CUSTOM_DURATION_BLOCK_MINUTES * 60_000)) + 1;
                            const requestedDurationMinutes = baseDurationMinutes + requestedExtraBlockCount * CUSTOM_DURATION_BLOCK_MINUTES;
                            canInteract = availableSimsForWindow(availability.slots, selectedSlot.startsAt, requestedDurationMinutes) > 0;
                          } else {
                            canInteract = false;
                          }
                        }
                      }
                      const subtitle = isWindowSelected
                        ? isBaseWindowSelected
                          ? isStartSelected
                            ? 'selected start'
                            : 'selected window'
                          : 'extra time'
                        : slotSubtitle(slot, baseDurationMinutes, baseWindowAvailableSims);
                      return (
                        <Grid key={slot.startsAt} size={{ xs: 6, sm: 4, md: 3 }}>
                          <Button
                            fullWidth
                            variant={isWindowSelected ? 'contained' : 'outlined'}
                            disabled={!canInteract}
                            onClick={() => toggleSlot(slot)}
                            sx={{
                              minHeight: 78,
                              flexDirection: 'column',
                              borderColor: isWindowSelected ? 'rgba(255,210,0,0.92)' : baseWindowAvailableSims > 0 ? undefined : 'rgba(255,255,255,0.14)',
                              bgcolor: isWindowSelected ? 'rgba(255,210,0,0.92)' : undefined,
                              color: isWindowSelected ? '#050505' : undefined,
                              boxShadow: isWindowSelected ? '0 0 0 1px rgba(255,210,0,0.9), 0 0 24px rgba(255,210,0,0.18)' : undefined,
                              '&:hover': isWindowSelected
                                ? {
                                    bgcolor: '#FFD200',
                                    borderColor: '#FFD200'
                                  }
                                : undefined,
                              '&.Mui-disabled': {
                                color: 'rgba(255,255,255,0.45)',
                                bgcolor: 'rgba(255,22,31,0.72)',
                                borderColor: 'rgba(255,255,255,0.12)'
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
                    const enabled = Boolean(selectedSlot && count <= selectedWindowAvailableSims);
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
              <Box>
                <Typography color="text.secondary" sx={{ mb: 1 }}>
                  Race request
                </Typography>
                <ToggleButtonGroup
                  value={raceRequestMode}
                  exclusive
                  fullWidth
                  disabled={Boolean(clientSecret)}
                  onChange={(_event, value: RaceRequestMode | null) => {
                    if (!value) return;
                    setRaceRequestMode(value);
                    setSelectedVehicle(null);
                    setSelectedCircuit(null);
                    setSelectedEvent(null);
                  }}
                >
                  <ToggleButton value="none">No preference</ToggleButton>
                  <ToggleButton value="hotlap_event" disabled={!selectedSlot}>
                    Live event
                  </ToggleButton>
                  <ToggleButton value="vehicle_circuit">Car + track</ToggleButton>
                </ToggleButtonGroup>
                {raceRequestMode === 'hotlap_event' ? (
                  <Box sx={{ mt: 1.5 }}>
                    <LiveEventSelect
                      label="Live hotlap event"
                      value={selectedEvent}
                      onChange={setSelectedEvent}
                      disabled={Boolean(clientSecret) || !selectedSlot}
                      startsAt={selectedSlot?.startsAt}
                      helperText="Only events live during this booking time are shown."
                    />
                  </Box>
                ) : null}
                {raceRequestMode === 'vehicle_circuit' ? (
                  <Grid container spacing={1.25} sx={{ mt: 1.5 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <RaceOptionAutocomplete
                        type="vehicle"
                        label="Vehicle"
                        value={selectedVehicle}
                        onChange={setSelectedVehicle}
                        disabled={Boolean(clientSecret)}
                        helperText="Pick a VMS vehicle result."
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <RaceOptionAutocomplete
                        type="circuit"
                        label="Track"
                        value={selectedCircuit}
                        onChange={setSelectedCircuit}
                        disabled={Boolean(clientSecret)}
                        helperText="Pick a VMS circuit result."
                      />
                    </Grid>
                  </Grid>
                ) : null}
              </Box>
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
