'use client';

import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { racingDiscountSchema, MAX_RACING_DISCOUNT_PERCENT, type RacingDiscount } from '@/lib/bookings/discount';

export function RacingDiscountAdmin() {
  const [saved, setSaved] = useState<RacingDiscount | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/racing-discount', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      const value = racingDiscountSchema.parse(json.discount);
      setSaved(value); setEnabled(value.enabled); setPercent(String(value.percent));
    } catch { setError('Unable to load discount settings. Retry before making changes.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  const parsed = racingDiscountSchema.safeParse({ enabled, percent: percent.trim() ? Number(percent) : NaN });
  const dirty = saved && (saved.enabled !== enabled || saved.percent !== Number(percent));
  async function save() {
    if (!parsed.success) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/racing-discount', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'Save failed');
      const value = racingDiscountSchema.parse(json.discount);
      setSaved(value); setEnabled(value.enabled); setPercent(String(value.percent));
      setMessage(value.enabled ? `Saved: ${value.percent}% off standard racing is active.` : 'Saved: discount mode is off. Standard racing prices restored.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Discount was not saved.'); }
    finally { setBusy(false); }
  }
  return <Card variant="outlined" sx={{ maxWidth: 720 }}><CardContent><Stack spacing={2.5}>
    <Typography variant="h5" sx={{ fontWeight: 900 }}>Racing timeslots</Typography>
    <Typography color="text.secondary">Discount standard website racing bookings while this mode is active. Includes solo, group, and extended sessions. Membership pricing, food, merch, and private-event deposits are unchanged.</Typography>
    {saved && <Alert severity={saved.enabled ? 'success' : 'info'}>Currently {saved.enabled ? `ON — ${saved.percent}% off` : 'OFF — standard prices'}</Alert>}
    {error && <Alert severity="error" action={!saved ? <Button color="inherit" onClick={load} disabled={busy}>Retry</Button> : undefined}>{error}</Alert>}
    {message && <Alert severity="success" role="status">{message}</Alert>}
    <FormControlLabel label="Discount mode" control={<Switch checked={enabled} disabled={!saved || busy} onChange={(e) => { setEnabled(e.target.checked); setMessage(''); }} />} />
    <TextField label="Amount to discount (%)" type="number" value={percent} disabled={!saved || busy} onChange={(e) => { setPercent(e.target.value); setMessage(''); }} inputProps={{ min: 0, max: MAX_RACING_DISCOUNT_PERCENT, step: 1 }} error={Boolean(saved) && !parsed.success} helperText={!parsed.success && saved ? parsed.error.issues[0]?.message : 'Whole percentages, 0–95%. The limit keeps the shortest session above the card-payment minimum.'} />
    <Typography color="text.secondary" variant="body2">Changes take effect when saved. New checkouts use the current setting; a checkout already started keeps its quoted price for its existing 10-minute hold. Open price pages refresh within 30 seconds.</Typography>
    <Button variant="contained" onClick={save} disabled={!saved || busy || !dirty || !parsed.success}>{busy ? 'Please wait…' : 'Save discount settings'}</Button>
  </Stack></CardContent></Card>;
}
