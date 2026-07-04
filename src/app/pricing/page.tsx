import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { MembershipCheckoutButton } from '@/components/MembershipCheckoutButton';
import { MEMBERSHIP_DISCOUNT_PERCENT, hasUnusedMonthlyRace, isMembershipActive, membershipBookingPrice } from '@/lib/membership';
import { getAuthedProfile } from '@/lib/supabase/profile';

const quickRacePricing = [
  {
    name: 'Quick Race Session',
    durationMinutes: 15,
    duration: '15 minutes',
    price: '$15',
    description: 'A fast hit of sim racing for first timers, quick rematches, and lunch-break laps.'
  },
  {
    name: 'Quick Race Session',
    durationMinutes: 30,
    duration: '30 minutes',
    price: '$26',
    description: 'More seat time, more attempts, and a better shot at climbing the STR leaderboard.'
  }
];

const futureOptions = [
  'Private group racing',
  'Gift cards',
  'League nights',
  'Restaurant event packages'
];

const membershipPerks = [
  {
    number: '01',
    title: '10% off, everything.',
    body: 'Sim sessions, food, drinks. One rate, every visit.'
  },
  {
    number: '02',
    title: 'Priority booking.',
    body: 'Reserve sim time 14 days out. Public books 7.'
  },
  {
    number: '03',
    title: 'Welcome kit.',
    body: 'Member card and sticker pack at signup.'
  },
  {
    number: '04',
    title: 'Birthday perk.',
    body: 'A free 30-minute sim session in your birthday month.'
  },
  {
    number: '05',
    title: 'Member events.',
    body: 'Invitations to Cars & Coffee, watch parties, and private gatherings.'
  }
];

function memberPriceLabel(durationMinutes: number, profile: Awaited<ReturnType<typeof getAuthedProfile>>['profile']) {
  const price = membershipBookingPrice({ durationMinutes, simCount: 1, profile });
  if (!price || !profile || !isMembershipActive(profile)) return null;
  if (price.amountCents === 0) return 'FREE this month';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price.amountCents / 100);
}

export default async function PricingPage() {
  const { user, profile } = await getAuthedProfile().catch(() => ({ user: null, profile: null }));
  const membershipActive = isMembershipActive(profile);
  const monthlyRaceAvailable = hasUnusedMonthlyRace(profile);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        overflow: 'hidden',
        background:
          'radial-gradient(900px 420px at 82% 6%, rgba(255,22,31,0.24), transparent 58%), linear-gradient(180deg, #050505 0%, #0A0A0A 52%, #050505 100%)'
      }}
    >
      <AppShell>
        <Stack spacing={{ xs: 4, md: 6 }} sx={{ pb: 6 }}>
          <Box
            sx={{
              width: '100vw',
              ml: 'calc(50% - 50vw)',
              mt: -3,
              px: { xs: 2, sm: 3, md: 6 },
              py: { xs: 7, md: 10 },
              position: 'relative',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
              backgroundImage:
                'linear-gradient(90deg, rgba(0,0,0,0.94), rgba(0,0,0,0.64), rgba(0,0,0,0.88)), url(/home/venue-collage.webp)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: 0.2,
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
                backgroundSize: '46px 46px'
              }
            }}
          >
            <Stack spacing={2.5} sx={{ position: 'relative', zIndex: 1, width: 'min(1120px, 100%)', mx: 'auto' }}>
              <Chip label="Race pricing" color="primary" sx={{ alignSelf: 'flex-start' }} />
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: 52, sm: 72, md: 104 },
                  lineHeight: 0.88,
                  fontWeight: 950,
                  letterSpacing: 0,
                  textTransform: 'uppercase',
                  maxWidth: 980
                }}
              >
                Pick a session. Chase a faster lap.
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 680, fontSize: { xs: 18, md: 22 }, lineHeight: 1.45 }}>
                Pick your pace with 2 simple pricing options, tailored for casual group nights or official leaderboard title shots.
              </Typography>
            </Stack>
          </Box>

          <Grid container spacing={2}>
            {quickRacePricing.map((item) => (
              <Grid key={item.duration} size={{ xs: 12, md: 6 }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    borderColor: 'rgba(255,210,0,0.42)',
                    background: 'linear-gradient(135deg, rgba(255,210,0,0.10), rgba(255,22,31,0.08)), rgba(255,255,255,0.045)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 5,
                      background: 'linear-gradient(90deg, #FFD200, #FF161F)'
                    }
                  }}
                >
                  <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                    <Stack spacing={2.5}>
                      <Box>
                        <Typography color="primary" sx={{ fontWeight: 950, textTransform: 'uppercase' }}>
                          {item.name}
                        </Typography>
                        <Typography variant="h3" sx={{ mt: 0.5, fontWeight: 950 }}>
                          {item.duration}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: { xs: 68, md: 84 }, lineHeight: 0.9, fontWeight: 950, color: '#FFD200' }}>
                        {item.price}
                      </Typography>
                      {membershipActive ? (
                        <Chip
                          color="primary"
                          label={
                            monthlyRaceAvailable
                              ? `${memberPriceLabel(item.durationMinutes, profile)} for members`
                              : `${memberPriceLabel(item.durationMinutes, profile)} member price`
                          }
                          sx={{ alignSelf: 'flex-start', fontWeight: 900 }}
                        />
                      ) : null}
                      <Typography color="text.secondary">{item.description}</Typography>
                      <Button
                        component={Link}
                        href={`/book?duration=${item.durationMinutes}`}
                        variant="contained"
                        size="large"
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Book a Race
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box
            component="section"
            sx={{
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(255,210,0,0.52)',
              bgcolor: '#080808',
              p: { xs: 2.5, md: 5 },
              boxShadow: '0 28px 80px rgba(0,0,0,0.42)',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: 0.18,
                backgroundImage:
                  'linear-gradient(rgba(255,210,0,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,210,0,0.10) 1px, transparent 1px)',
                backgroundSize: '34px 34px'
              }
            }}
          >
            <Grid container spacing={{ xs: 3, md: 5 }} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Stack spacing={2.25}>
                  <Chip label="Membership" color="primary" sx={{ alignSelf: 'flex-start', fontWeight: 900 }} />
                  <Box>
                    <Typography
                      component="h2"
                      sx={{
                        fontSize: { xs: 52, md: 82 },
                        lineHeight: 0.9,
                        fontWeight: 950,
                        letterSpacing: 0,
                        textTransform: 'uppercase'
                      }}
                    >
                      The
                      <Box component="span" sx={{ display: 'block', color: '#FF161F', fontStyle: 'italic' }}>
                        Membership.
                      </Box>
                    </Typography>
                    <Typography sx={{ mt: 1.5, fontSize: { xs: 34, md: 46 }, fontWeight: 950 }}>
                      $25 / month.
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 18 }}>
                      Five perks. One rate. Built simple.
                    </Typography>
                  </Box>
                  {membershipActive ? (
                    <Stack spacing={1}>
                      <Alert severity="success">
                        {monthlyRaceAvailable
                          ? 'Your membership is active. This month’s race credit is ready.'
                          : `Your membership is active. You still get ${MEMBERSHIP_DISCOUNT_PERCENT}% off member pricing.`}
                      </Alert>
                      <MembershipCheckoutButton manage>Manage membership</MembershipCheckoutButton>
                    </Stack>
                  ) : (
                    <Stack spacing={1.5}>
                      <MembershipCheckoutButton>Join for $25/month</MembershipCheckoutButton>
                      {!user ? (
                        <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                          You’ll sign in first so Stripe can attach the membership to your Speed Trap profile.
                        </Typography>
                      ) : null}
                    </Stack>
                  )}
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={1.5}>
                  <Typography color="primary" sx={{ fontWeight: 950, letterSpacing: 0, textTransform: 'uppercase' }}>
                    What you get
                  </Typography>
                  {membershipPerks.map((perk) => (
                    <Box
                      key={perk.number}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '48px 1fr', sm: '72px 1fr' },
                        gap: 2,
                        alignItems: 'start',
                        p: { xs: 1.5, md: 2 },
                        border: '1px solid rgba(255,255,255,0.10)',
                        bgcolor: 'rgba(255,255,255,0.045)'
                      }}
                    >
                      <Typography sx={{ color: '#FF161F', fontWeight: 950, fontSize: { xs: 24, md: 30 } }}>
                        {perk.number}
                      </Typography>
                      <Box>
                        <Typography sx={{ fontWeight: 950, fontSize: { xs: 20, md: 24 }, fontStyle: 'italic' }}>
                          {perk.title}
                        </Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.25 }}>
                          {perk.body}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Box>

          <Grid container spacing={3} alignItems="stretch">
            <Grid size={{ xs: 12, md: 7 }}>
              <Box
                sx={{
                  height: '100%',
                  minHeight: 340,
                  p: { xs: 2.5, md: 4 },
                  border: '1px solid rgba(255,255,255,0.12)',
                  bgcolor: 'rgba(255,255,255,0.045)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 950 }}>
                    Group racing is coming soon.
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 680 }}>
                    Check back soon for private event bookings, group rates, and gift cards!
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 3 }}>
                  {futureOptions.map((option) => (
                    <Chip key={option} label={option} variant="outlined" />
                  ))}
                </Stack>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  height: '100%',
                  minHeight: 340,
                  border: '1px solid rgba(255,255,255,0.12)',
                  backgroundImage:
                    'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.82)), url(/home/venue-collage.webp)',
                  backgroundSize: '230%',
                  backgroundPosition: '78% 50%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  p: 3
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 950 }}>
                  Race, eat, and keep the leaderboard alive all night.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Stack>
      </AppShell>
    </Box>
  );
}
