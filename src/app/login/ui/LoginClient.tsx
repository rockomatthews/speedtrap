'use client';

import { useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { env } from '@/lib/supabase/env';

export function LoginClient({ redirectTo }: { redirectTo: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : '');

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  return (
    <AppShell>
      <Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 2, md: 6 } }}>
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 520,
            p: { xs: 3, md: 4 },
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
          }}
        >
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                Sign in
              </Typography>
              <Typography color="text.secondary">
                Use email (magic link) or Google to access your customer portal.
              </Typography>
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {status === 'sent' ? (
              <Alert severity="success">Check your inbox for a sign-in link.</Alert>
            ) : null}

            <Stack spacing={1.5}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={async () => {
                  setError(null);
                  try {
                    const { error } = await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: {
                        redirectTo: `${siteUrl}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
                      }
                    });
                    if (error) throw error;
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Failed to start Google sign-in.');
                  }
                }}
              >
                Continue with Google
              </Button>

              <Typography sx={{ opacity: 0.7, textAlign: 'center' }}>or</Typography>

              <TextField
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
              <Button
                variant="outlined"
                color="primary"
                size="large"
                disabled={status === 'loading' || email.trim().length < 3}
                onClick={async () => {
                  setError(null);
                  setStatus('loading');
                  try {
                    const { error } = await supabase.auth.signInWithOtp({
                      email: email.trim(),
                      options: {
                        emailRedirectTo: `${siteUrl}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
                      }
                    });
                    if (error) throw error;
                    setStatus('sent');
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Failed to send magic link.');
                  } finally {
                    setStatus((s) => (s === 'sent' ? 'sent' : 'idle'));
                  }
                }}
              >
                {status === 'loading' ? <CircularProgress size={18} /> : 'Email me a sign-in link'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </AppShell>
  );
}


