import { redirect } from 'next/navigation';
import Link from 'next/link';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';

const featureCards = [
  { title: 'Connected racing rigs', body: 'Four venue sims feed VMS timing so hotlap challenges feel official, not scribbled on a whiteboard.' },
  { title: 'Arcade bar energy', body: 'Drop in for laps, bring friends, watch the board move, and make it a night instead of a spreadsheet.' },
  { title: 'Live leaderboard chase', body: 'Create a racing username, join a challenge, then come back to see where your clean laps landed.' }
];

const pricingTeasers = [
  ['Single Race Session', '$25'],
  ['Driver Pack', '$90'],
  ['Group Racing', 'From $250']
];

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const code = sp.code;
  if (typeof code === 'string' && code.length > 0) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&redirectTo=${encodeURIComponent('/dashboard')}`);
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, rgba(0,0,0,0.35), #080808 72%), radial-gradient(900px 420px at 12% 8%, rgba(255,42,42,0.20), transparent 58%), #080808'
      }}
    >
      <AppShell>
        <Stack spacing={{ xs: 5, md: 7 }}>
          <Box
            sx={{
              minHeight: { xs: 'calc(100vh - 170px)', md: 'calc(100vh - 150px)' },
              display: 'grid',
              alignItems: 'center',
              position: 'relative',
              pb: { xs: 3, md: 5 },
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: { xs: '-24px -16px', md: '-24px -48px' },
                zIndex: 0,
                backgroundImage:
                  'linear-gradient(90deg, rgba(0,0,0,0.92), rgba(0,0,0,0.32) 48%, rgba(0,0,0,0.86)), url(/brand/blurBackground.jpeg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.10)'
              }
            }}
          >
            <Stack spacing={3} sx={{ position: 'relative', zIndex: 1, maxWidth: 840 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label="Lakewood" color="primary" />
                <Chip label="Sim racing bar" variant="outlined" />
                <Chip label="VMS timed challenges" variant="outlined" />
              </Stack>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: 48, sm: 72, md: 104 },
                  lineHeight: 0.9,
                  fontWeight: 950,
                  letterSpacing: 0,
                  maxWidth: 920,
                  textTransform: 'uppercase'
                }}
              >
                Race. Drink. Climb the board.
              </Typography>
              <Typography variant="h5" color="text.secondary" sx={{ maxWidth: 680, lineHeight: 1.45 }}>
                Speed Trap Racing is an arcade-style sim racing venue where friends chase clean laps, staff-run challenges, and bragging
                rights on VMS-powered leaderboards.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Button component={Link} href="/login?redirectTo=/dashboard" variant="contained" size="large">
                  Join a Hotlap
                </Button>
                <Button component={Link} href="/pricing" variant="outlined" size="large">
                  See Pricing
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Grid container spacing={2}>
            {featureCards.map((feature) => (
              <Grid key={feature.title} size={{ xs: 12, md: 4 }}>
                <Card variant="outlined" sx={{ height: '100%', borderColor: 'rgba(255,255,255,0.12)' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {feature.title}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      {feature.body}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card variant="outlined" sx={{ height: '100%', borderColor: 'rgba(255,210,0,0.35)' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Chip label="Featured challenge" color="primary" sx={{ alignSelf: 'flex-start' }} />
                    <Typography variant="h4" sx={{ fontWeight: 900 }}>
                      Hotlap nights are built for repeat attempts.
                    </Typography>
                    <Typography color="text.secondary">
                      Sign in, create your racing username, join the active challenge, then run laps on the connected rigs. Your best eligible
                      laps come from VMS and your place shows on the leaderboard.
                    </Typography>
                    <Button component={Link} href="/how-it-works" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                      How It Works
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card variant="outlined" sx={{ height: '100%', borderColor: 'rgba(255,255,255,0.12)' }}>
                <CardContent>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Draft Pricing
                  </Typography>
                  <Stack spacing={1.25} sx={{ mt: 2 }}>
                    {pricingTeasers.map(([name, price]) => (
                      <Stack key={name} direction="row" justifyContent="space-between">
                        <Typography>{name}</Typography>
                        <Typography sx={{ fontWeight: 900 }}>{price}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button component={Link} href="/pricing" variant="contained" sx={{ mt: 2 }}>
                    View Table
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ pb: 5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: '100%', borderColor: 'rgba(255,255,255,0.12)' }}>
                <CardContent>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Race Radar
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Notes from the venue: challenge recaps, setup tips, race-night stories, and posts your staff can publish from admin.
                  </Typography>
                  <Button component={Link} href="/race-radar" variant="outlined" sx={{ mt: 2 }}>
                    Read Race Radar
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: '100%', borderColor: 'rgba(255,255,255,0.12)' }}>
                <CardContent>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Merch and bragging rights
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Grab Speed Trap gear, show up with your crew, and make your leaderboard name the one everyone is chasing.
                  </Typography>
                  <Button component={Link} href="/merch" variant="outlined" sx={{ mt: 2 }}>
                    Shop Merch
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      </AppShell>
    </Box>
  );
}
