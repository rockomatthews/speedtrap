'use client';

import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid2';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VENUE_TIME_ZONE = 'America/New_York';

type Rule = {
  id?: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  active: boolean;
  max_sims: number;
};

type Blackout = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

type RaceBooking = {
  id: string;
  source: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  duration_minutes: number;
  sim_count: number;
  starts_at: string;
  ends_at: string;
  amount_cents: number;
  currency: string;
  status: string;
  vms_booking_id: number | null;
  error: string | null;
  reminder_sent_at: string | null;
  reminder_error: string | null;
  membership_free_race_applied: boolean;
  membership_discount_cents: number;
  race_request_type: string | null;
  requested_vehicle_name: string | null;
  requested_circuit_name: string | null;
  requested_hotlap_event_name: string | null;
  created_at: string;
};

type ToastSession = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  session_quantity: number | null;
  session_minutes: number | null;
  status: string;
  vms_booking_id: number | null;
  error: string | null;
  ignored_reason: string | null;
  processed_at: string | null;
  created_at: string;
};

function venueParts(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VENUE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function venueDate(value: Date | string) {
  const parts = venueParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function todayVenueDate() {
  return venueDate(new Date());
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return next.toISOString().slice(0, 10);
}

function weekStartFor(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return addDays(date, -anchor.getUTCDay());
}

function formatDateHeading(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: VENUE_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatBookingWindow(booking: RaceBooking) {
  return `${formatTime(booking.starts_at)} - ${formatTime(booking.ends_at)}`;
}

function timeValue(value: string) {
  return value?.slice(0, 5) || '12:00';
}

function statusColor(status: string) {
  if (status === 'confirmed' || status === 'booked') return 'success';
  if (status.includes('failed')) return 'error';
  if (status === 'refunded' || status === 'cancelled') return 'default';
  return 'warning';
}

function money(cents: number | null | undefined, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((cents ?? 0) / 100);
}

function raceRequestLabel(booking: RaceBooking) {
  if (booking.race_request_type === 'vehicle_circuit') {
    return [booking.requested_vehicle_name, booking.requested_circuit_name].filter(Boolean).join(' at ') || null;
  }
  if (booking.race_request_type === 'hotlap_event') return booking.requested_hotlap_event_name;
  return null;
}

export function AdminBookingsClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [raceBookings, setRaceBookings] = useState<RaceBooking[]>([]);
  const [toastSessions, setToastSessions] = useState<ToastSession[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayVenueDate);
  const [blackoutStart, setBlackoutStart] = useState('');
  const [blackoutEnd, setBlackoutEnd] = useState('');
  const [blackoutReason, setBlackoutReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const weekStart = useMemo(() => weekStartFor(selectedDate), [selectedDate]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_item, index) => addDays(weekStart, index)), [weekStart]);
  const selectedBookings = useMemo(
    () => raceBookings.filter((booking) => venueDate(booking.starts_at) === selectedDate),
    [raceBookings, selectedDate]
  );
  const selectedSims = selectedBookings.reduce((sum, booking) => sum + Number(booking.sim_count ?? 0), 0);
  const selectedRevenue = selectedBookings.reduce((sum, booking) => sum + Number(booking.amount_cents ?? 0), 0);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [scheduleRes, bookingsRes] = await Promise.all([
        fetch('/api/admin/bookings/schedule'),
        fetch(`/api/admin/bookings?weekStart=${encodeURIComponent(weekStart)}`)
      ]);
      const schedule = await scheduleRes.json().catch(() => null);
      const bookings = await bookingsRes.json().catch(() => null);
      if (!scheduleRes.ok) throw new Error(schedule?.error ?? 'Failed to load schedule.');
      if (!bookingsRes.ok) throw new Error(bookings?.error ?? 'Failed to load bookings.');
      setRules((schedule.rules ?? []).map((rule: Rule) => ({ ...rule, max_sims: Number(rule.max_sims ?? 4) })));
      setBlackouts(schedule.blackouts ?? []);
      setRaceBookings(bookings.raceBookings ?? []);
      setToastSessions(bookings.toastSessions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bookings admin.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [weekStart]);

  function updateRule(index: number, patch: Partial<Rule>) {
    setRules((prev) => prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  async function saveSchedule() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/bookings/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Failed to save schedule.');
      setRules(json.rules ?? rules);
      setMessage('Schedule saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  }

  async function addBlackout() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/bookings/blackouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starts_at: new Date(blackoutStart).toISOString(),
          ends_at: new Date(blackoutEnd).toISOString(),
          reason: blackoutReason
        })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Failed to add blackout.');
      setBlackoutStart('');
      setBlackoutEnd('');
      setBlackoutReason('');
      setMessage('Blackout added.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add blackout.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteBlackout(id: string) {
    const res = await fetch(`/api/admin/bookings/blackouts/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  if (loading) return <CircularProgress size={24} />;

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,210,0,0.55)', background: 'linear-gradient(135deg, rgba(255,210,0,0.08), rgba(255,22,31,0.06))' }}>
        <CardContent>
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'flex-end' }}>
              <Stack spacing={0.75}>
                <Typography variant="overline" color="primary" sx={{ fontWeight: 900, letterSpacing: 0 }}>
                  Operations Board
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  {formatDateHeading(selectedDate)}
                </Typography>
                <Typography color="text.secondary">
                  {selectedBookings.length} booking{selectedBookings.length === 1 ? '' : 's'} · {selectedSims} sim
                  {selectedSims === 1 ? '' : 's'} reserved · {money(selectedRevenue)}
                </Typography>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="outlined" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                  Previous Day
                </Button>
                <TextField
                  type="date"
                  label="View date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value || todayVenueDate())}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: { sm: 180 } }}
                />
                <Button variant="outlined" onClick={() => setSelectedDate(todayVenueDate())}>
                  Today
                </Button>
                <Button variant="outlined" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                  Next Day
                </Button>
              </Stack>
            </Stack>

            <Grid container spacing={1}>
              {weekDates.map((date) => {
                const bookings = raceBookings.filter((booking) => venueDate(booking.starts_at) === date);
                const simCount = bookings.reduce((sum, booking) => sum + Number(booking.sim_count ?? 0), 0);
                const revenue = bookings.reduce((sum, booking) => sum + Number(booking.amount_cents ?? 0), 0);
                const active = date === selectedDate;
                return (
                  <Grid key={date} size={{ xs: 12, sm: 6, md: 3, lg: 12 / 7 }}>
                    <Button
                      fullWidth
                      variant={active ? 'contained' : 'outlined'}
                      onClick={() => setSelectedDate(date)}
                      sx={{
                        minHeight: 104,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        borderColor: active ? 'primary.main' : 'rgba(255,255,255,0.16)',
                        backgroundColor: active ? 'primary.main' : 'rgba(255,255,255,0.03)',
                        color: active ? 'black' : 'text.primary'
                      }}
                    >
                      <Stack spacing={0.5} sx={{ width: '100%' }}>
                        <Typography sx={{ fontWeight: 900 }}>{DAYS[new Date(`${date}T12:00:00.000Z`).getUTCDay()]}</Typography>
                        <Typography variant="body2">{date.slice(5).replace('-', '/')}</Typography>
                        <Typography variant="caption">
                          {bookings.length} booking{bookings.length === 1 ? '' : 's'} · {simCount} sim{simCount === 1 ? '' : 's'}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 900 }}>
                          {money(revenue)}
                        </Typography>
                      </Stack>
                    </Button>
                  </Grid>
                );
              })}
            </Grid>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

            <Stack spacing={1.25}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Bookings for {formatDateHeading(selectedDate)}
                </Typography>
                <Button variant="text" onClick={() => void load()}>
                  Refresh VMS + Site Bookings
                </Button>
              </Stack>
              {selectedBookings.length ? (
                selectedBookings.map((booking) => (
                  <Box
                    key={booking.id}
                    sx={{
                      p: 1.5,
                      border: '1px solid rgba(255,255,255,0.12)',
                      backgroundColor: 'rgba(0,0,0,0.22)'
                    }}
                  >
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                          <Typography sx={{ fontWeight: 900 }}>{formatBookingWindow(booking)}</Typography>
                          <Chip size="small" label={booking.status} color={statusColor(booking.status) as any} />
                          <Chip size="small" label={booking.source.replaceAll('_', ' ')} />
                          {booking.vms_booking_id ? <Chip size="small" color="success" label={`VMS #${booking.vms_booking_id}`} /> : null}
                        </Stack>
                        <Typography>
                          {booking.customer_name} · {booking.sim_count} racer{booking.sim_count === 1 ? '' : 's'} · {booking.duration_minutes} min
                        </Typography>
                        {raceRequestLabel(booking) ? (
                          <Typography variant="body2" color="primary" sx={{ fontWeight: 800 }}>
                            Race request: {raceRequestLabel(booking)}
                          </Typography>
                        ) : null}
                        <Typography variant="body2" color="text.secondary">
                          {booking.customer_email}
                          {booking.customer_phone ? ` · ${booking.customer_phone}` : ''}
                          {booking.reminder_sent_at ? ` · reminder sent ${formatTime(booking.reminder_sent_at)}` : ''}
                          {booking.reminder_error ? ` · reminder error: ${booking.reminder_error}` : ''}
                          {booking.error ? ` · error: ${booking.error}` : ''}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
                        {booking.membership_free_race_applied ? <Chip size="small" color="primary" label="Member free race" sx={{ fontWeight: 900 }} /> : null}
                        {Number(booking.membership_discount_cents ?? 0) > 0 ? (
                          <Chip size="small" color="success" label={`Member savings ${money(booking.membership_discount_cents, booking.currency)}`} sx={{ fontWeight: 900 }} />
                        ) : null}
                        <Chip size="small" label={money(booking.amount_cents, booking.currency)} />
                      </Stack>
                    </Stack>
                  </Box>
                ))
              ) : (
                <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                  <Typography sx={{ fontWeight: 900 }}>No bookings for this day.</Typography>
                  <Typography color="text.secondary">Use the date controls above to check another day.</Typography>
                </Box>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Weekly Booking Hours
            </Typography>
            <Grid container spacing={1.25}>
              {rules.map((rule, index) => (
                <Grid key={rule.id ?? `${rule.day_of_week}-${index}`} size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Typography sx={{ fontWeight: 900, width: { sm: 44 } }}>{DAYS[rule.day_of_week]}</Typography>
                      <TextField
                        type="time"
                        size="small"
                        value={timeValue(rule.opens_at)}
                        onChange={(e) => updateRule(index, { opens_at: e.target.value })}
                        sx={{ minWidth: { sm: 132 } }}
                      />
                      <TextField
                        type="time"
                        size="small"
                        value={timeValue(rule.closes_at)}
                        onChange={(e) => updateRule(index, { closes_at: e.target.value })}
                        sx={{ minWidth: { sm: 132 } }}
                      />
                      <TextField
                        select
                        label="Sims"
                        size="small"
                        value={String(rule.max_sims ?? 4)}
                        onChange={(e) => updateRule(index, { max_sims: Number(e.target.value) })}
                        sx={{ minWidth: { sm: 96 } }}
                      >
                        {[1, 2, 3, 4].map((count) => (
                          <MenuItem key={count} value={count}>
                            {count}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Switch checked={rule.active} onChange={(e) => updateRule(index, { active: e.target.checked })} />
                        <Typography variant="body2" color="text.secondary">
                          Open
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Button variant="contained" onClick={saveSchedule} disabled={saving} sx={{ alignSelf: 'flex-start' }}>
              Save Hours
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Blackouts
            </Typography>
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Start"
                  type="datetime-local"
                  value={blackoutStart}
                  onChange={(e) => setBlackoutStart(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="End"
                  type="datetime-local"
                  value={blackoutEnd}
                  onChange={(e) => setBlackoutEnd(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField label="Reason" value={blackoutReason} onChange={(e) => setBlackoutReason(e.target.value)} fullWidth />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Button fullWidth variant="contained" disabled={!blackoutStart || !blackoutEnd || saving} onClick={addBlackout}>
                  Add
                </Button>
              </Grid>
            </Grid>
            <Stack spacing={1}>
              {blackouts.map((blackout) => (
                <Stack key={blackout.id} direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                  <Typography color="text.secondary">
                    {new Date(blackout.starts_at).toLocaleString()} - {new Date(blackout.ends_at).toLocaleString()} ·{' '}
                    {blackout.reason ?? 'Blackout'}
                  </Typography>
                  <Button color="error" onClick={() => void deleteBlackout(blackout.id)}>
                    Delete
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              All Bookings This Week
            </Typography>
            {raceBookings.length ? (
              raceBookings.map((booking) => (
                <Stack key={booking.id} direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                  <Typography>
                    {venueDate(booking.starts_at)} · {formatBookingWindow(booking)} · {booking.customer_name} · {booking.sim_count} x{' '}
                    {booking.duration_minutes} min{raceRequestLabel(booking) ? ` · ${raceRequestLabel(booking)}` : ''}
                  </Typography>
                  <Stack direction="row" spacing={0.75}>
                    <Chip size="small" label={money(booking.amount_cents, booking.currency)} />
                    <Chip size="small" label={booking.status} color={statusColor(booking.status) as any} />
                  </Stack>
                </Stack>
              ))
            ) : (
              <Typography color="text.secondary">No bookings in this week.</Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Recent Toast Walk-ins
            </Typography>
            {toastSessions.map((session) => (
              <Stack key={session.id} direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                <Typography>
                  {session.customer_name ?? 'Toast guest'} · {session.session_quantity} x {session.session_minutes} min
                </Typography>
                <Chip size="small" label={session.status} color={statusColor(session.status) as any} />
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
