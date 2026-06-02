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
  ['Create your handle', 'Sign in and choose the racing username people will see on Speed Trap challenge screens.'],
  ['Join a hotlap challenge', 'Pick an active or upcoming challenge from the portal. Signup is saved on the site; staff-run timing stays in VMS.'],
  ['Race on the connected sims', 'At the venue, run laps on the rigs assigned to the challenge. Clean laps become eligible for the board.'],
  ['Track your place', 'Leaderboards pull results from VMS and highlight your row when your customer profile matches the timing data.']
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
            Speed Trap is built around venue racing: sign up online, race in person, and let VMS timing settle the leaderboard.
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
                  VMS records the lap data from the connected sims. Speed Trap displays those results, including every eligible driver VMS
                  returns, so the leaderboard is tied to actual venue racing rather than manual entry.
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
