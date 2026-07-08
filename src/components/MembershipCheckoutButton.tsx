'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export function MembershipCheckoutButton({
  children = 'Join for $45/month',
  manage = false,
  collectBirthday = false,
  existingBirthday = null
}: {
  children?: ReactNode;
  manage?: boolean;
  collectBirthday?: boolean;
  existingBirthday?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [birthday, setBirthday] = useState(existingBirthday ?? '');

  async function start() {
    setLoading(true);
    try {
      const response = await fetch(manage ? '/api/stripe/membership/portal' : '/api/stripe/membership/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: manage ? undefined : JSON.stringify({ birthday: collectBirthday && birthday ? birthday : null })
      });
      const json = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (response.status === 401) {
        window.location.href = `/login?redirectTo=${encodeURIComponent('/pricing')}`;
        return;
      }
      if (!response.ok || !json?.url) throw new Error(json?.error ?? 'Could not open Stripe.');
      window.location.href = json.url;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not open Stripe.');
    } finally {
      setLoading(false);
    }
  }

  if (collectBirthday && !manage) {
    return (
      <Stack spacing={1.25} sx={{ alignItems: 'flex-start' }}>
        <TextField
          type="date"
          label="Birthday"
          value={birthday}
          onChange={(event) => setBirthday(event.target.value)}
          helperText="Used for your free 30-minute birthday-month session."
          InputLabelProps={{ shrink: true }}
          sx={{ maxWidth: 280 }}
        />
        <Button variant="contained" size="large" onClick={start} disabled={loading} sx={{ alignSelf: 'flex-start' }}>
          {loading ? <CircularProgress color="inherit" size={22} /> : children}
        </Button>
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
          You can join without it, but the birthday session needs a birthday on file.
        </Typography>
      </Stack>
    );
  }

  return (
    <Button variant="contained" size="large" onClick={start} disabled={loading} sx={{ alignSelf: 'flex-start' }}>
      {loading ? <CircularProgress color="inherit" size={22} /> : children}
    </Button>
  );
}
