'use client';

import { useEffect, useState } from 'react';

import EditIcon from '@mui/icons-material/Edit';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SportsMotorsportsIcon from '@mui/icons-material/SportsMotorsports';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { DriverRacingProfile, type DriverDetail } from '@/components/portal/DriverRacingProfile';
import { type VmsCustomerProfile } from '@/lib/vms/types';

type ProfileResponse = {
  customer?: VmsCustomerProfile;
  profile?: {
    avatarUrl?: string | null;
    displayName?: string | null;
  };
  error?: string;
  warning?: string | null;
};

function valueOrEmpty(value: string | null | undefined) {
  return value ?? '';
}

export function VmsProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [customer, setCustomer] = useState<VmsCustomerProfile | null>(null);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [driverDetail, setDriverDetail] = useState<DriverDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function hydrate(response: ProfileResponse | null) {
    const nextCustomer = response?.customer ?? null;
    const displayName = response?.profile?.displayName;
    const nextName = valueOrEmpty(nextCustomer?.name || displayName);
    setCustomer(nextCustomer ? { ...nextCustomer, name: nextName } : null);
    setName(nextName);
    setAvatarUrl(response?.profile?.avatarUrl ?? null);
    setWarning(response?.warning ?? null);
    setEditing(nextName.trim().length < 3);
    return nextCustomer ? { ...nextCustomer, name: nextName } : null;
  }

  async function loadDriverDetail(customerId: number) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/vms/drivers/${customerId}?lapCount=20`);
      const json = (await res.json().catch(() => null)) as (DriverDetail & { error?: string }) | null;
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      if (json?.driver) {
        setDriverDetail({
          driver: json.driver,
          laps: json.laps ?? [],
          placements: json.placements ?? []
        });
      }
    } catch (e) {
      setWarning(e instanceof Error ? e.message : 'Driver racing history is not available yet.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const ensureRes = await fetch('/api/vms/customers/ensure', { method: 'POST' });
      const ensureJson = (await ensureRes.json().catch(() => null)) as ProfileResponse | null;
      if (!ensureRes.ok) throw new Error(ensureJson?.error ?? `Failed (${ensureRes.status})`);

      const profileRes = await fetch('/api/vms/customer-profile');
      const profileJson = (await profileRes.json().catch(() => null)) as ProfileResponse | null;
      if (!profileRes.ok) {
        const ensuredCustomer = hydrate(ensureJson);
        if (ensuredCustomer?.id) void loadDriverDetail(ensuredCustomer.id);
        throw new Error(profileJson?.error ?? `Failed (${profileRes.status})`);
      }
      const nextCustomer = hydrate(profileJson);
      if (nextCustomer?.id) void loadDriverDetail(nextCustomer.id);
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
    setWarning(null);
    try {
      const res = await fetch('/api/vms/customer-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const json = (await res.json().catch(() => null)) as ProfileResponse | null;
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      if (!json?.customer) throw new Error('VMS did not return the updated profile.');
      const nextCustomer = hydrate(json);
      if (nextCustomer?.id) void loadDriverDetail(nextCustomer.id);
      setEditing(false);
      setMessage(json.warning ? 'Driver profile saved on Speed Trap.' : 'VMS profile updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update VMS profile.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set('avatar', file);
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData
      });
      const json = (await res.json().catch(() => null)) as { avatarUrl?: string; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      setAvatarUrl(json?.avatarUrl ?? null);
      setMessage('Profile picture updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update profile picture.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <CircularProgress size={22} />;

  const hasDriverName = valueOrEmpty(customer?.name || name).trim().length >= 3;

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden', borderColor: hasDriverName ? 'rgba(255,210,0,0.4)' : 'rgba(255,255,255,0.12)' }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={avatarUrl ?? undefined}
                sx={{
                  width: 104,
                  height: 104,
                  bgcolor: '#151515',
                  color: 'primary.main',
                  border: '2px solid rgba(255,210,0,0.65)'
                }}
              >
                <SportsMotorsportsIcon sx={{ fontSize: 58 }} />
              </Avatar>
              <IconButton
                component="label"
                size="small"
                disabled={uploading}
                aria-label="Change profile picture"
                sx={{
                  position: 'absolute',
                  right: -6,
                  bottom: -6,
                  bgcolor: 'primary.main',
                  color: 'common.black',
                  '&:hover': { bgcolor: 'primary.dark' }
                }}
              >
                <PhotoCameraIcon fontSize="small" />
                <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => void uploadAvatar(event.target.files?.[0] ?? null)} />
              </IconButton>
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h5" sx={{ fontWeight: 950, overflowWrap: 'anywhere' }}>
                  {hasDriverName ? customer?.name || name : 'Driver Registration'}
                </Typography>
                {hasDriverName ? (
                  <IconButton size="small" aria-label="Edit driver name" onClick={() => setEditing((value) => !value)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Stack>
              <Typography color="text.secondary">
                {hasDriverName
                  ? 'Your Speed Trap driver profile is ready for leaderboards and hotlap challenges.'
                  : 'Enter the driver name you want shown in VMS and on leaderboards. Your signed-in email is used automatically.'}
              </Typography>
            </Box>
          </Stack>

          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}
          {warning ? <Alert severity="warning">{warning}</Alert> : null}

          {editing ? (
            <Stack spacing={1.5}>
              <TextField
                label="Driver name"
                placeholder="Rocket_Rob"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
              />

              <Stack direction="row" spacing={1}>
                <Button variant="contained" disabled={saving || name.trim().length < 3} onClick={save} sx={{ alignSelf: 'flex-start' }}>
                  {saving ? 'Saving...' : 'Save driver info'}
                </Button>
                {hasDriverName ? (
                  <Button variant="text" color="inherit" disabled={saving} onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          ) : null}

          {detailLoading ? <CircularProgress size={18} /> : null}
          {driverDetail ? <DriverRacingProfile detail={driverDetail} /> : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
