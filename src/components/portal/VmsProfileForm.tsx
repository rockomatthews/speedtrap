'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { type VmsCustomerProfile } from '@/lib/vms/types';

type ProfileResponse = {
  customer?: VmsCustomerProfile;
  error?: string;
};

function valueOrEmpty(value: string | null | undefined) {
  return value ?? '';
}

export function VmsProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  function hydrate(customer: VmsCustomerProfile) {
    setName(customer.name);
    setEmail(valueOrEmpty(customer.email));
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const ensureRes = await fetch('/api/vms/customers/ensure', { method: 'POST' });
      const ensureJson = (await ensureRes.json().catch(() => null)) as ProfileResponse | null;
      if (!ensureRes.ok) throw new Error(ensureJson?.error ?? `Failed (${ensureRes.status})`);
      if (!ensureJson?.customer) throw new Error('VMS did not return a customer profile.');
      hydrate(ensureJson.customer);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load VMS profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/vms/customer-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      const json = (await res.json().catch(() => null)) as ProfileResponse | null;
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      if (!json?.customer) throw new Error('VMS did not return the updated profile.');
      hydrate(json.customer);
      setMessage('VMS profile updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update VMS profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <CircularProgress size={22} />;

  return (
    <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Driver Registration
          </Typography>
          <Typography color="text.secondary">
            VMS only needs your driver name and email here. New drivers are assigned to the venue's Rookie class in VMS.
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Driver name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            </Grid>
          </Grid>

          <Button variant="contained" disabled={saving || name.trim().length < 3} onClick={save} sx={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving...' : 'Save driver info'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
