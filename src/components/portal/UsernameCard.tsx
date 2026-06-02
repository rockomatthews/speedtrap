'use client';

import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export function UsernameCard({
  initialUsername,
  onSaved
}: {
  initialUsername?: string | null;
  onSaved?: (username: string) => void;
}) {
  const [username, setUsername] = useState(initialUsername ?? '');
  const [savedUsername, setSavedUsername] = useState(initialUsername ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const json = (await res.json().catch(() => null)) as { profile?: { username?: string | null }; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to save username.');
      const next = json?.profile?.username ?? username.trim().toLowerCase();
      setSavedUsername(next);
      setUsername(next);
      setMessage('Racing username saved.');
      onSaved?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save username.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="outlined" sx={{ borderColor: savedUsername ? 'rgba(255,255,255,0.12)' : 'rgba(255,210,0,0.45)' }}>
      <CardContent>
        <Stack spacing={1.25}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Racing username
          </Typography>
          <Typography color="text.secondary">
            This is your public handle on Speed Trap challenge screens. VMS timing still connects through your account behind the scenes.
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="fastlap_rob"
              helperText="3-20 characters: letters, numbers, underscores, or dashes."
              fullWidth
            />
            <Button
              variant="contained"
              disabled={saving || username.trim().toLowerCase() === savedUsername}
              onClick={save}
              sx={{ minWidth: 140 }}
            >
              {saving ? 'Saving...' : savedUsername ? 'Update' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
