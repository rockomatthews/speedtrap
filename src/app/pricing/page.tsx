import Link from 'next/link';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';

const pricingPlans = [
  {
    name: 'Single Race Session',
    price: '$25',
    detail: '30 minutes',
    description: 'Simulator access, staff setup, and eligibility for active venue hotlap challenges.',
    cta: 'Start with one run'
  },
  {
    name: 'Driver Pack',
    price: '$90',
    detail: 'Four 30-minute sessions',
    description: 'Four sessions for repeat attempts, practice nights, and leaderboard climbing.',
    cta: 'Best for regulars',
    featured: true
  },
  {
    name: 'Party / Group Racing',
    price: 'From $250',
    detail: 'Private group format',
    description: 'Staff-supported race setup for friends, teams, birthdays, or company nights.',
    cta: 'Plan a group night'
  }
];

export default function PricingPage() {
  return (
    <AppShell>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Typography variant="h3" sx={{ fontWeight: 950 }}>
            Pricing
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 740 }}>
            Draft pricing for Speed Trap Racing. Final venue packages can be adjusted here as operations settle.
          </Typography>
        </Stack>

        <Grid container spacing={2}>
          {pricingPlans.map((plan) => (
            <Grid key={plan.name} size={{ xs: 12, md: 4 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  borderColor: plan.featured ? 'rgba(255,210,0,0.55)' : 'rgba(255,255,255,0.12)'
                }}
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    {plan.featured ? <Chip label="Popular" color="primary" sx={{ alignSelf: 'flex-start' }} /> : null}
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                      {plan.name}
                    </Typography>
                    <Stack spacing={0}>
                      <Typography variant="h3" sx={{ fontWeight: 950 }}>
                        {plan.price}
                      </Typography>
                      <Typography color="text.secondary">{plan.detail}</Typography>
                    </Stack>
                    <Typography color="text.secondary">{plan.description}</Typography>
                    <Button component={Link} href="/login?redirectTo=/dashboard" variant={plan.featured ? 'contained' : 'outlined'}>
                      {plan.cta}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              What is included?
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Racing sessions include simulator access and staff setup. Active hotlap challenge participation is included when a challenge is
              running and your laps are recorded by VMS.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </AppShell>
  );
}
