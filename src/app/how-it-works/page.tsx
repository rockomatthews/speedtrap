import Link from 'next/link';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';

const steps = [
  ['Ready to Race?', "Sign up to get started, or sign in if you're already a registered driver."],
  ['Join a hotlap challenge', 'Once you are signed in, pick an active or upcoming challenge from the portal.'],
  ['Race on the connected sims', 'At the venue, run laps on the rigs assigned to the challenge. Clean laps become eligible for the board.'],
  [
    'Track your place',
    'Run your laps, grab a drink, and watch the board. Our leaderboards sync with the STR timing system to automatically highlight your stats and show the whole room your rank.'
  ]
];

export default function HowItWorksPage() {
  return (
    <AppShell>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 950 }}>
            How It Works
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>
            Speed Trap is built for live venue racing. Just sign up online, step into the cockpit in person, and let STR timing rank you on
            the leaderboard.
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {steps.map(([title, body], index) => (
            <Grid key={title} size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: '100%', borderColor: 'rgba(255,255,255,0.12)' }}>
                <CardContent>
                  <Typography color="primary" sx={{ fontWeight: 900 }}>
                    STEP {index + 1}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 900 }}>
                    {title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {body}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Card variant="outlined" sx={{ borderColor: 'rgba(255,210,0,0.35)' }}>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  What counts as a leaderboard lap?
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>
                  Real sims. Real timing. No manual entry. The STR system tracks your lap data live from the cockpit and shoots it straight
                  to the Speed Trap leaderboard. What you see on the screen is exactly what went down on the track.
                </Typography>
              </Box>
              <Button component={Link} href="/login?redirectTo=/dashboard" variant="contained" sx={{ alignSelf: { md: 'center' } }}>
                Join a Challenge
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </AppShell>
  );
}
