'use client';

import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type PrivateEventQuote = {
  id: string;
  public_token: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  event_starts_at: string | null;
  event_duration_minutes: number | null;
  guest_count: number | null;
  sim_count: number | null;
  total_amount_cents: number;
  deposit_percent: number;
  deposit_amount_cents: number;
  currency: string;
  notes: string | null;
  status: 'quote_sent' | 'deposit_paid' | 'cancelled' | 'refunded';
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  deposit_paid_at: string | null;
  created_at: string;
  updated_at: string;
};

const emptyForm = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  eventStartsAt: '',
  eventDurationMinutes: '',
  guestCount: '',
  simCount: '',
  totalAmount: '',
  notes: ''
};

function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

function dateTime(value: string | null | undefined) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function statusColor(status: PrivateEventQuote['status']) {
  if (status === 'deposit_paid') return 'success';
  if (status === 'cancelled' || status === 'refunded') return 'default';
  return 'warning';
}

export function AdminPrivateEventsClient() {
  const [quotes, setQuotes] = useState<PrivateEventQuote[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [latestLink, setLatestLink] = useState('');

  const depositPreview = useMemo(() => {
    const value = Number(form.totalAmount);
    if (!Number.isFinite(value) || value <= 0) return '$0.00';
    return money(Math.round(value * 100 * 0.5));
  }, [form.totalAmount]);

  async function loadQuotes() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/private-event-deposits', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to load private event deposit links.');
      setQuotes(payload.quotes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load private event deposit links.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuotes();
  }, []);

  function linkFor(quote: PrivateEventQuote) {
    return `${window.location.origin}/private-events/deposit/${quote.public_token}`;
  }

  async function copyQuoteLink(quote: PrivateEventQuote) {
    const link = linkFor(quote);
    await navigator.clipboard.writeText(link);
    setMessage('Deposit link copied.');
    setLatestLink(link);
  }

  async function createQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setLatestLink('');

    try {
      const response = await fetch('/api/admin/private-event-deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerPhone: form.customerPhone || undefined,
          eventStartsAt: form.eventStartsAt || undefined,
          eventDurationMinutes: form.eventDurationMinutes || undefined,
          guestCount: form.guestCount || undefined,
          simCount: form.simCount || undefined,
          totalAmount: form.totalAmount,
          notes: form.notes || undefined
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to create deposit link.');

      const quote = payload.quote as PrivateEventQuote;
      setQuotes((current) => [quote, ...current]);
      setForm(emptyForm);
      const link = linkFor(quote);
      setLatestLink(link);
      await navigator.clipboard.writeText(link).catch(() => undefined);
      setMessage('50% deposit link created and copied.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deposit link.');
    } finally {
      setSaving(false);
    }
  }

  async function cancelQuote(id: string) {
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/private-event-deposits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'cancelled' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to cancel deposit link.');
      setQuotes((current) => current.map((quote) => (quote.id === id ? payload.quote : quote)));
      setMessage('Deposit link cancelled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel deposit link.');
    }
  }

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}
      {latestLink ? (
        <Alert severity="info" sx={{ overflowWrap: 'anywhere' }}>
          Share this link: {latestLink}
        </Alert>
      ) : null}

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,210,0,0.55)' }}>
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={createQuote}>
            <Stack spacing={0.5}>
              <Typography variant="h5" sx={{ fontWeight: 950 }}>
                Create 50% Deposit Link
              </Typography>
              <Typography color="text.secondary">
                Enter the full private-event price. The customer payment link charges exactly half.
              </Typography>
            </Stack>

            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Customer name"
                  value={form.customerName}
                  onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Customer email"
                  type="email"
                  value={form.customerEmail}
                  onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Customer phone"
                  value={form.customerPhone}
                  onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Event date and time"
                  type="datetime-local"
                  value={form.eventStartsAt}
                  onChange={(event) => setForm((current) => ({ ...current, eventStartsAt: event.target.value }))}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Full event price"
                  type="number"
                  value={form.totalAmount}
                  onChange={(event) => setForm((current) => ({ ...current, totalAmount: event.target.value }))}
                  helperText={`Customer deposit: ${depositPreview}`}
                  required
                  fullWidth
                  slotProps={{ htmlInput: { min: 1, step: '0.01' } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Duration minutes"
                  type="number"
                  value={form.eventDurationMinutes}
                  onChange={(event) => setForm((current) => ({ ...current, eventDurationMinutes: event.target.value }))}
                  fullWidth
                  slotProps={{ htmlInput: { min: 1 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Guest count"
                  type="number"
                  value={form.guestCount}
                  onChange={(event) => setForm((current) => ({ ...current, guestCount: event.target.value }))}
                  fullWidth
                  slotProps={{ htmlInput: { min: 1 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Sims needed"
                  type="number"
                  value={form.simCount}
                  onChange={(event) => setForm((current) => ({ ...current, simCount: event.target.value }))}
                  fullWidth
                  slotProps={{ htmlInput: { min: 1, max: 4 } }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Private notes"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  multiline
                  minRows={3}
                  fullWidth
                />
              </Grid>
            </Grid>

            <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: 'flex-start' }}>
              {saving ? 'Creating...' : 'Create and Copy Deposit Link'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={1.25}>
        <Typography variant="h5" sx={{ fontWeight: 950 }}>
          Deposit Links
        </Typography>
        {loading ? <Typography color="text.secondary">Loading deposit links...</Typography> : null}
        {!loading && !quotes.length ? <Typography color="text.secondary">No private event deposit links yet.</Typography> : null}
        {quotes.map((quote) => (
          <Card key={quote.id} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            <CardContent>
              <Stack spacing={1.25}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                  <Stack spacing={0.25}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="h6" sx={{ fontWeight: 950 }}>
                        {quote.customer_name}
                      </Typography>
                      <Chip size="small" color={statusColor(quote.status)} label={quote.status.replaceAll('_', ' ')} sx={{ fontWeight: 900 }} />
                    </Stack>
                    <Typography color="text.secondary">
                      {quote.customer_email}
                      {quote.customer_phone ? ` | ${quote.customer_phone}` : ''}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button variant="outlined" onClick={() => copyQuoteLink(quote)}>
                      Copy Link
                    </Button>
                    {quote.status === 'quote_sent' ? (
                      <Button color="error" variant="outlined" onClick={() => cancelQuote(quote.id)}>
                        Cancel
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>

                <Grid container spacing={1}>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Box sx={{ border: '1px solid rgba(255,255,255,0.12)', p: 1.25 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                        Total quote
                      </Typography>
                      <Typography sx={{ fontWeight: 950 }}>{money(quote.total_amount_cents, quote.currency)}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Box sx={{ border: '1px solid rgba(255,255,255,0.12)', p: 1.25 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                        Deposit due
                      </Typography>
                      <Typography sx={{ fontWeight: 950 }}>{money(quote.deposit_amount_cents, quote.currency)}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Box sx={{ border: '1px solid rgba(255,255,255,0.12)', p: 1.25 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                        Event time
                      </Typography>
                      <Typography sx={{ fontWeight: 950 }}>{dateTime(quote.event_starts_at)}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Box sx={{ border: '1px solid rgba(255,255,255,0.12)', p: 1.25 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                        Party details
                      </Typography>
                      <Typography sx={{ fontWeight: 950 }}>
                        {quote.guest_count ? `${quote.guest_count} guests` : 'Guests TBD'}
                        {quote.sim_count ? ` | ${quote.sim_count} sims` : ''}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {quote.notes ? <Typography color="text.secondary">{quote.notes}</Typography> : null}
                {quote.deposit_paid_at ? (
                  <Alert severity="success">Deposit paid {dateTime(quote.deposit_paid_at)}.</Alert>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
