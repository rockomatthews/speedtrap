import { redirect } from 'next/navigation';

import Paper from '@mui/material/Paper';
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
    <Box
      sx={{
        minHeight: '100vh',
        backgroundImage: 'url(/brand/blurBackground.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        overflow: 'hidden',
        // Elastic/vignette sides
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/brand/blurBackground.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(22px)',
          transform: 'scale(1.08)',
          opacity: 0.9,
          // show the blur only on the sides
          maskImage:
            'linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 72%, rgba(0,0,0,1) 90%, rgba(0,0,0,1) 100%)',
          WebkitMaskImage:
            'linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 72%, rgba(0,0,0,1) 90%, rgba(0,0,0,1) 100%)'
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.65)), linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0) 18%, rgba(0,0,0,0) 82%, rgba(0,0,0,0.85))'
        }
      }}
    >
      <AppShell>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 6 },
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.10)',
            background:
              'radial-gradient(1000px 600px at 50% 0%, rgba(255,210,0,0.18), rgba(0,0,0,0) 60%), linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
            backdropFilter: 'blur(6px)'
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

          <Typography
            variant="h2"
            sx={{
              position: 'relative',
              fontWeight: 900,
              letterSpacing: -1,
              textShadow: '0 6px 30px rgba(0,0,0,0.45)'
            }}
          >
            Under Construction
          </Typography>
        </Paper>
      </AppShell>
    </Box>
  );
}


