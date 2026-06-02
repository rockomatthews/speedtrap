'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid2';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { type VmsClass, type VmsCustomerProfile } from '@/lib/vms/types';

type ProfileResponse = {
  customer?: VmsCustomerProfile;
  classes?: VmsClass[];
  error?: string;
};

function valueOrEmpty(value: string | null | undefined) {
  return value ?? '';
}

export function VmsProfileForm() {
  const [classes, setClasses] = useState<VmsClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [tel, setTel] = useState('');
  const [cell, setCell] = useState('');
  const [email, setEmail] = useState('');
  const [emailOptin, setEmailOptin] = useState(false);
  const [postalCode, setPostalCode] = useState('');
  const [classId, setClassId] = useState('');

  function hydrate(customer: VmsCustomerProfile) {
    setName(customer.name);
    setTel(valueOrEmpty(customer.tel));
    setCell(valueOrEmpty(customer.cell));
    setEmail(valueOrEmpty(customer.email));
    setEmailOptin(Boolean(customer.emailOptin));
    setPostalCode(valueOrEmpty(customer.postalCode));
    setClassId(customer.classId ? String(customer.classId) : '');
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const ensureRes = await fetch('/api/vms/customers/ensure', { method: 'POST' });
      const ensureJson = (await ensureRes.json().catch(() => null)) as ProfileResponse | null;
      if (!ensureRes.ok) throw new Error(ensureJson?.error ?? `Failed (${ensureRes.status})`);

      const res = await fetch('/api/vms/customer-profile');
      const json = (await res.json().catch(() => null)) as ProfileResponse | null;
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      if (!json?.customer) throw new Error('VMS did not return a customer profile.');
      hydrate(json.customer);
      setClasses(json.classes ?? []);
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
        body: JSON.stringify({
          name,
          tel,
          cell,
          email,
          emailOptin,
          postalCode,
          classId: classId ? Number(classId) : null
        })
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
            VMS Driver Profile
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Driver name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel id="vms-class-label">Driver class</InputLabel>
                <Select labelId="vms-class-label" label="Driver class" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <MenuItem value="">Unclassed</MenuItem>
                  {classes.map((driverClass) => (
                    <MenuItem key={driverClass.id} value={String(driverClass.id)}>
                      {driverClass.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Phone" value={tel} onChange={(e) => setTel(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Cell" value={cell} onChange={(e) => setCell(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField label="Postal code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} fullWidth />
            </Grid>
          </Grid>

          <FormControlLabel
            control={<Checkbox checked={emailOptin} onChange={(_, checked) => setEmailOptin(checked)} />}
            label="Email opt-in"
          />

          <Button variant="contained" disabled={saving || name.trim().length < 3} onClick={save} sx={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving...' : 'Save VMS profile'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
