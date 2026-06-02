'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { type VmsCustomerProfile } from '@/lib/vms/types';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function stat(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '-' : value;
}

function ProfileStat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 900, fontSize: 22, lineHeight: 1.1 }}>{stat(value)}</Typography>
      <Typography color="text.secondary" sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0 }}>
        {label}
      </Typography>
    </Box>
  );
}

export function VmsDriverProfileCard() {
  const [customer, setCustomer] = useState<VmsCustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const ensureRes = await fetch('/api/vms/customers/ensure', { method: 'POST' });
        const ensureJson = (await ensureRes.json().catch(() => null)) as { customer?: VmsCustomerProfile; error?: string } | null;
        if (!ensureRes.ok) throw new Error(ensureJson?.error ?? `Failed (${ensureRes.status})`);
        if (!cancelled && ensureJson?.customer) setCustomer(ensureJson.customer);

        const profileRes = await fetch('/api/vms/customer-profile');
        const profileJson = (await profileRes.json().catch(() => null)) as { customer?: VmsCustomerProfile; error?: string } | null;
        if (!profileRes.ok) throw new Error(profileJson?.error ?? `Failed (${profileRes.status})`);
        if (!cancelled) setCustomer(profileJson?.customer ?? ensureJson?.customer ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load VMS profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <CircularProgress size={22} />;
  if (error) return <Alert severity="warning">VMS driver profile not ready: {error}</Alert>;
  if (!customer) return <Alert severity="warning">VMS did not return a driver profile.</Alert>;

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden', borderColor: 'rgba(255,210,0,0.35)' }}>
      <Box
        sx={{
          minHeight: 180,
          display: 'grid',
          placeItems: 'center',
          background:
            'linear-gradient(135deg, rgba(255,22,31,0.35), rgba(255,210,0,0.22)), radial-gradient(circle at center, rgba(255,255,255,0.12), transparent 55%), #111'
        }}
      >
        <Avatar sx={{ width: 116, height: 116, bgcolor: '#FFD200', color: '#0B0B0B', fontSize: 38, fontWeight: 950 }}>
          {initials(customer.name) || 'ST'}
        </Avatar>
      </Box>
      <CardContent>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 950 }}>
              {customer.name}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ mt: 1 }}>
              <Chip label={customer.className ?? 'Unclassed'} color="primary" />
              {customer.homeVenue ? <Chip label={customer.homeVenue} variant="outlined" /> : null}
            </Stack>
          </Box>

          <Grid container spacing={2} sx={{ width: '100%' }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProfileStat label="Laps Recorded" value={customer.lapsRecorded} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProfileStat label="Last Circuit" value={customer.lastCircuit} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProfileStat label="Last Vehicle" value={customer.lastVehicle} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <ProfileStat label="Last Visit" value={customer.lastVisit} />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ width: '100%' }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ProfileStat label="Last Group Event" value={customer.lastGroupEvent} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ProfileStat label="Last Race Event" value={customer.lastRaceEvent} />
            </Grid>
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}
