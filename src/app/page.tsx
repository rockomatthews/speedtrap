import Link from 'next/link';
import { redirect } from 'next/navigation';

import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import { AppShell } from '@/components/AppShell';

export default async function HomePage({
  searchParams
}: {
  // Next.js 15.5 types `searchParams` as a Promise in generated PageProps.
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const code = sp.code;
  // Safety net: if an auth flow returns to `/` with `?code=...`, forward to our callback handler.
  if (typeof code === 'string' && code.length > 0) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&redirectTo=${encodeURIComponent('/dashboard')}`);
  }

  return (
    <AppShell>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 6 },
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.10)',
          background:
            'radial-gradient(1000px 600px at 50% 0%, rgba(255,210,0,0.18), rgba(0,0,0,0) 60%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.18,
            background:
              'linear-gradient(90deg, rgba(255,42,42,0.35), rgba(255,210,0,0.35)), radial-gradient(900px 420px at 10% 10%, rgba(255,42,42,0.25), rgba(0,0,0,0) 55%)',
            filter: 'blur(10px)'
          }}
        />

        <Stack spacing={3} sx={{ position: 'relative' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label="Website Under Construction"
              size="small"
              sx={{
                bgcolor: 'rgba(255,210,0,0.14)',
                border: '1px solid rgba(255,210,0,0.35)',
                color: '#FFD200',
                fontWeight: 800
              }}
            />
          </Stack>

          <Typography
            variant="h2"
            sx={{
              fontWeight: 900,
              letterSpacing: -1,
              textShadow: '0 6px 30px rgba(0,0,0,0.45)'
            }}
          >
            Website Under Construction
          </Typography>

          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 720 }}>
            Black. Red. Yellow. Built for race nights: booking, customer portals, and performance stats powered by the
            Sim Racing VMS API.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            <Button component={Link} href="/login" variant="contained" color="primary" size="large">
              Sign Up
            </Button>
            <Button component={Link} href="/login" variant="outlined" color="primary" size="large">
              Sign In
            </Button>
            <Button component={Link} href="/book" variant="text" color="secondary" size="large">
              Book a Race
            </Button>
          </Stack>

          <Box sx={{ pt: 2 }}>
            <Typography
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                fontWeight: 900,
                letterSpacing: 1
              }}
            >
              <span style={{ color: '#FFD200' }}>RACES START IN</span>
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 900, mt: 1 }}>
              0d 0h 0m 0s
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </AppShell>
  );
}


