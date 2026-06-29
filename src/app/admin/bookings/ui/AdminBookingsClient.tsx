'use client';

import { useEffect, useState } from 'react';

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
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export function AdminBookingsClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [raceBookings, setRaceBookings] = useState<any[]>([]);
  const [toastSessions, setToastSessions] = useState<any[]>([]);
  const [blackoutStart, setBlackoutStart] = useState('');
  const [blackoutEnd, setBlackoutEnd] = useState('');
  const [blackoutReason, setBlackoutReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [scheduleRes, bookingsRes] = await Promise.all([fetch('/api/admin/bookings/schedule'), fetch('/api/admin/bookings')]);
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
  }, []);

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
              Recent Online Bookings
            </Typography>
            {raceBookings.map((booking) => (
              <Stack key={booking.id} direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                <Stack spacing={0.5}>
                  <Typography>
                    {booking.customer_name} · {booking.sim_count} x {booking.duration_minutes} min ·{' '}
                    {new Date(booking.starts_at).toLocaleString()}
                    {booking.reminder_sent_at ? ` · reminder sent ${new Date(booking.reminder_sent_at).toLocaleTimeString()}` : ''}
                    {booking.reminder_error ? ` · reminder error: ${booking.reminder_error}` : ''}
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap">
                    {booking.membership_free_race_applied ? <Chip size="small" color="primary" label="Member free race" sx={{ fontWeight: 900 }} /> : null}
                    {Number(booking.membership_discount_cents ?? 0) > 0 ? (
                      <Chip
                        size="small"
                        color="success"
                        label={`Member savings ${money(booking.membership_discount_cents, booking.currency)}`}
                        sx={{ fontWeight: 900 }}
                      />
                    ) : null}
                    {!booking.membership_free_race_applied && Number(booking.membership_discount_cents ?? 0) === 0 ? (
                      <Chip size="small" label="Non-member price" />
                    ) : null}
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={0.75}>
                  <Chip size="small" label={money(booking.amount_cents, booking.currency)} />
                  <Chip size="small" label={booking.status} color={statusColor(booking.status) as any} />
                </Stack>
              </Stack>
            ))}
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
