import { redirect } from 'next/navigation';
import Link from 'next/link';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { NavBar } from '@/components/NavBar';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const quickRacePricing = [
  { label: 'Quick Race', minutes: '15 min', price: '$15', note: 'Fast laps, first timers, and quick rematches.' },
  { label: 'Full Session', minutes: '30 min', price: '$28', note: 'More attempts, better rhythm, bigger leaderboard swings.' }
];

const experienceHighlights = [
  { title: 'Four connected sims', body: 'Rigs feed STR timing so every clean lap has a real shot at the board.' },
  { title: 'Restaurant energy', body: 'Grab food and drinks, rotate drivers, and turn one session into a night out.' },
  { title: 'Live challenge culture', body: 'Join a standing hotlap, race in person, and watch the leaderboard move.' }
];

const leaderboardRows = [
  { rank: '01', driver: 'ROCKETSHIP', lap: '1:42.119', delta: 'leader' },
  { rank: '02', driver: 'APEXHUNTER', lap: '1:42.482', delta: '+0.363' },
  { rank: '03', driver: 'NIGHTSHIFT', lap: '1:43.004', delta: '+0.885' }
];

const mediaTiles = [
  { title: 'Restaurant and bar', image: '/home/speedtrap-restaurant-bar.jpg', objectPosition: '52% 50%' },
  { title: 'Simulator bays', image: '/home/speedtrap-lone-sims.jpg', objectPosition: '50% 56%' },
  { title: 'Group nights', image: '/home/speedtrap-happy-eaters.jpg', objectPosition: '50% 44%' }
];

const footerLinks = ['How It Works', 'Pricing', 'Race Radar', 'Menu', 'Merch'];

const bookHref = '/book?duration=15';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type FooterScheduleRule = {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  active: boolean;
};

function formatFooterTime(value: string) {
  const [hourPart, minutePart = '00'] = value.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return minute === 0 ? `${displayHour} ${period}` : `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function dayRangeLabel(start: number, end: number) {
  return start === end ? dayLabels[start] : `${dayLabels[start]}-${dayLabels[end]}`;
}

function formatFooterHours(rules: FooterScheduleRule[]) {
  const orderedRules = [...rules]
    .filter((rule) => Number.isInteger(rule.day_of_week) && rule.day_of_week >= 0 && rule.day_of_week <= 6)
    .sort((a, b) => a.day_of_week - b.day_of_week);

  if (orderedRules.length === 0) return 'Hours: 11 AM-11 PM';

  const dailyHours = Array.from({ length: 7 }, (_item, day) => {
    const rule = orderedRules.find((item) => item.day_of_week === day);
    if (!rule || !rule.active) return { day, label: 'Closed' };
    return { day, label: `${formatFooterTime(rule.opens_at)}-${formatFooterTime(rule.closes_at)}` };
  });

  const groups: Array<{ start: number; end: number; label: string }> = [];
  for (const item of dailyHours) {
    const current = groups.at(-1);
    if (current && current.label === item.label && current.end === item.day - 1) {
      current.end = item.day;
    } else {
      groups.push({ start: item.day, end: item.day, label: item.label });
    }
  }

  return groups.map((group) => `${dayRangeLabel(group.start, group.end)}: ${group.label}`).join(' | ');
}

async function getFooterHours() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('venue_schedule_rules')
      .select('day_of_week, opens_at, closes_at, active')
      .order('day_of_week')
      .order('opens_at');
    if (error) throw error;
    return formatFooterHours(data ?? []);
  } catch (error) {
    console.error('Failed to load homepage footer hours', error);
    return 'Hours: 11 AM-11 PM';
  }
}

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
  const footerHours = await getFooterHours();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, #050505 0%, #0A0A0A 46%, #050505 100%), radial-gradient(900px 460px at 82% 12%, rgba(255,22,31,0.28), transparent 62%)'
      }}
    >
      <NavBar />
          <Box
            component="section"
            sx={{
              width: '100%',
              minHeight: { xs: 'calc(100svh - 64px)', md: 'calc(100svh - 72px)' },
              position: 'relative',
              display: 'grid',
              alignItems: 'end',
              pb: { xs: 5, md: 7 },
              pt: { xs: 12, md: 16 },
              borderBottom: '1px solid rgba(255,255,255,0.12)',
              backgroundImage:
                'linear-gradient(90deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.68) 43%, rgba(0,0,0,0.22) 70%, rgba(0,0,0,0.88) 100%), url(/home/speedtrap-hero-bar.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center 46%',
              isolation: 'isolate',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 1,
                opacity: 0.18,
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
                backgroundSize: '46px 46px'
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 1,
                background:
                  'repeating-linear-gradient(180deg, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 2px, transparent 7px)'
              }
            }}
          >
            <Box
              component="video"
              src="/home/smallerTEMPHERO.mp4"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                zIndex: 0
              }}
            />
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                background:
                  'linear-gradient(90deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.68) 43%, rgba(0,0,0,0.22) 70%, rgba(0,0,0,0.88) 100%)'
              }}
            />
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                right: { xs: -110, md: -40 },
                bottom: { xs: 24, md: 0 },
                width: { xs: 300, md: 560 },
                height: { xs: 120, md: 220 },
                zIndex: 2,
                transform: 'skewX(-24deg) rotate(-10deg)',
                background:
                  'linear-gradient(90deg, transparent 0 18%, #FFD200 18% 34%, transparent 34% 42%, #FF161F 42% 58%, transparent 58% 100%)',
                opacity: 0.92,
                filter: 'drop-shadow(0 0 24px rgba(255,22,31,0.36))'
              }}
            />
            <Box sx={{ position: 'relative', zIndex: 3, width: 'min(1180px, 100%)', mx: 'auto', px: { xs: 2, sm: 3, md: 6 } }}>
              <Grid container spacing={{ xs: 4, md: 6 }} alignItems="end">
                <Grid size={{ xs: 12, md: 7 }}>
                  <Stack spacing={3}>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip label="Sim racing restaurant" color="primary" />
                      <Chip label="Live leaderboard" color="primary" />
                      <Chip label="Four connected rigs" color="primary" />
                    </Stack>
                    <Typography
                      component="h1"
                      sx={{
                        maxWidth: 900,
                        fontSize: { xs: 52, sm: 76, md: 112 },
                        lineHeight: 0.86,
                        fontWeight: 950,
                        letterSpacing: 0,
                        textTransform: 'uppercase',
                        textWrap: 'balance'
                      }}
                    >
                      <Box component="span" sx={{ display: 'block', color: '#FFD200', fontStyle: 'italic' }}>
                        Race.
                      </Box>
                      <Box component="span" sx={{ display: 'block', color: '#FFFFFF', fontStyle: 'italic' }}>
                        Eat.
                      </Box>
                      <Box component="span" sx={{ display: 'block', color: '#FF161F', fontStyle: 'italic' }}>
                        Chase the board.
                      </Box>
                    </Typography>
                    <Typography
                      variant="h5"
                      color="text.secondary"
                      sx={{ maxWidth: 650, lineHeight: 1.45, fontSize: { xs: 19, md: 24 } }}
                    >
                      Sim racing sessions, drinks, and live leaderboards in one night out.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ maxWidth: { xs: 360, sm: 'none' } }}>
                      <Button component={Link} href={bookHref} variant="contained" size="large">
                        Book a Race
                      </Button>
                      <Button component={Link} href="/pricing" variant="outlined" size="large">
                        View Pricing
                      </Button>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Box
                    sx={{
                      border: '1px solid rgba(255,210,0,0.52)',
                      bgcolor: 'rgba(0,0,0,0.58)',
                      backdropFilter: 'blur(16px)',
                      boxShadow: '0 0 42px rgba(255,22,31,0.18)',
                      p: { xs: 2, md: 2.5 },
                      transform: { md: 'skew(-4deg)' }
                    }}
                  >
                    <Stack spacing={1.5} sx={{ transform: { md: 'skew(4deg)' } }}>
                      <Typography color="primary" sx={{ fontWeight: 950, textTransform: 'uppercase' }}>
                        Tonight's board
                      </Typography>
                      {leaderboardRows.map((row) => (
                        <Stack
                          key={row.rank}
                          direction="row"
                          alignItems="center"
                          spacing={1.5}
                          sx={{
                            px: 1.5,
                            py: 1.1,
                            bgcolor: row.rank === '01' ? 'rgba(255,210,0,0.92)' : 'rgba(255,255,255,0.08)',
                            color: row.rank === '01' ? '#050505' : '#fff',
                            borderLeft: row.rank === '01' ? '5px solid #FF161F' : '5px solid rgba(255,210,0,0.55)'
                          }}
                        >
                          <Typography sx={{ width: 34, fontWeight: 950 }}>{row.rank}</Typography>
                          <Typography sx={{ flex: 1, fontWeight: 950 }}>{row.driver}</Typography>
                          <Typography sx={{ fontWeight: 950 }}>{row.lap}</Typography>
                        </Stack>
                      ))}
                      <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                        Sign in, race in person, and let STR score the clean laps.
                      </Typography>
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Box>

      <Container sx={{ py: 3 }}>
        <Stack spacing={{ xs: 6, md: 9 }}>
          <Box component="section">
            <Grid container spacing={2}>
              {experienceHighlights.map((item) => (
                <Grid key={item.title} size={{ xs: 12, md: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      borderColor: 'rgba(255,255,255,0.12)',
                      bgcolor: 'rgba(255,255,255,0.045)',
                      transition: 'transform 180ms ease, border-color 180ms ease',
                      '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(255,210,0,0.55)' }
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 950 }}>
                        {item.title}
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        {item.body}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box component="section">
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                p: { xs: 2, md: 3 },
                border: '1px solid rgba(255,210,0,0.45)',
                borderBottom: '4px solid #FFD200',
                bgcolor: 'rgba(255,255,255,0.045)',
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,22,31,0.05)), radial-gradient(500px 240px at 92% 18%, rgba(255,22,31,0.20), transparent 68%)',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  right: -80,
                  top: -20,
                  width: 280,
                  height: 180,
                  transform: 'skewX(-24deg)',
                  background: 'linear-gradient(90deg, rgba(255,210,0,0.72), rgba(255,22,31,0.82))',
                  opacity: 0.2
                }
              }}
            >
              <Grid container spacing={2.5} alignItems="stretch" sx={{ position: 'relative', zIndex: 1 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={1} sx={{ height: '100%', justifyContent: 'center' }}>
                    <Typography color="secondary" sx={{ fontWeight: 950, fontStyle: 'italic', textTransform: 'uppercase' }}>
                      Quick race
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 950, fontStyle: 'italic', textTransform: 'uppercase' }}>
                      Choose your session
                    </Typography>
                    <Button component={Link} href="/pricing" variant="outlined" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                      See Pricing
                    </Button>
                  </Stack>
                </Grid>
                {quickRacePricing.map((item) => (
                  <Grid key={item.minutes} size={{ xs: 12, md: 4 }}>
                    <Box
                      sx={{
                        height: '100%',
                        minHeight: 160,
                        p: 2.5,
                        position: 'relative',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.18)',
                        bgcolor: 'rgba(0,0,0,0.32)',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          right: -38,
                          bottom: -44,
                          width: 150,
                          height: 150,
                          borderRadius: '50%',
                          border: '1px solid rgba(255,22,31,0.32)',
                          boxShadow: 'inset 0 0 0 10px rgba(255,22,31,0.06)'
                        }
                      }}
                    >
                      <Typography color="primary" sx={{ fontWeight: 950, textTransform: 'uppercase' }}>
                        {item.minutes}
                      </Typography>
                      <Typography sx={{ mt: 1, fontSize: { xs: 56, md: 64 }, lineHeight: 1, fontWeight: 950 }}>
                        {item.price}
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        {item.note}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Box>

          <Grid component="section" container spacing={3} alignItems="stretch">
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  height: '100%',
                  minHeight: 420,
                  border: '1px solid rgba(255,255,255,0.12)',
                  backgroundImage:
                    'linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.74)), url(/home/speedtrap-active-sims.jpg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center 48%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  p: { xs: 2, md: 3 }
                }}
              >
                <Stack spacing={1}>
                  <Typography variant="h4" sx={{ fontWeight: 950 }}>
                    A restaurant night with a race clock.
                  </Typography>
                  <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
                    Bring friends, rotate drivers, grab food and drinks, and keep one eye on the timing screen.
                  </Typography>
                </Stack>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={2} sx={{ height: '100%' }}>
                <Box>
                  <Chip label="Featured challenge" color="primary" />
                  <Typography variant="h3" sx={{ mt: 2, fontWeight: 950 }}>
                    Hotlap nights are built for repeat attempts.
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1.5 }}>
                    Create your STR driver profile by clicking "Sign Up", join the active challenge, and start running laps on the connected
                    rigs. Track the leaderboard to see where your best eligible lap ranks you against the competition!
                  </Typography>
                </Box>
                <Box sx={{ border: '1px solid rgba(255,255,255,0.12)', bgcolor: 'rgba(255,255,255,0.045)', p: 2 }}>
                  <Stack spacing={1}>
                    {leaderboardRows.map((row) => (
                      <Stack key={row.driver} direction="row" spacing={1.5} alignItems="center">
                        <Typography color="primary" sx={{ width: 34, fontWeight: 950 }}>
                          {row.rank}
                        </Typography>
                        <Typography sx={{ flex: 1, fontWeight: 850 }}>{row.driver}</Typography>
                        <Typography sx={{ fontWeight: 950 }}>{row.lap}</Typography>
                        <Typography color="text.secondary" sx={{ width: 72, textAlign: 'right' }}>
                          {row.delta}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
                <Button component={Link} href="/leaderboards" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                  View Leaderboards
                </Button>
              </Stack>
            </Grid>
          </Grid>

          <Box component="section">
            <Stack spacing={2}>
              <Typography variant="h3" sx={{ fontWeight: 950 }}>
                Built for the whole night
              </Typography>
              <Grid container spacing={2}>
                {mediaTiles.map((tile) => (
                  <Grid key={tile.title} size={{ xs: 12, md: 4 }}>
                    <Box
                      sx={{
                        minHeight: 280,
                        position: 'relative',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.12)',
                        backgroundImage: `url(${tile.image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: tile.objectPosition,
                        transition: 'transform 200ms ease, border-color 200ms ease',
                        '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(255,210,0,0.55)' },
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.86) 100%)'
                        }
                      }}
                    >
                      <Typography
                        sx={{
                          position: 'absolute',
                          zIndex: 1,
                          left: 18,
                          bottom: 16,
                          fontWeight: 950,
                          fontSize: 22
                        }}
                      >
                        {tile.title}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Box>

          <Box
            component="section"
            sx={{
              p: { xs: 2.5, md: 4 },
              border: '1px solid rgba(255,210,0,0.55)',
              bgcolor: '#050505',
              backgroundImage: 'none'
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 8 }}>
                <Typography variant="h3" sx={{ fontWeight: 950 }}>
                  Private events, gift cards, and leaderboard bragging rights.
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 780 }}>
                  Group racing and gift options are coming into focus. For now, book a race through the portal and keep an eye on Race Radar
                  for event drops.
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={1}>
                  <Button component={Link} href={bookHref} variant="contained" size="large">
                    Book a Race
                  </Button>
                  <Button component={Link} href="/race-radar" variant="outlined" size="large">
                    Read Race Radar
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>

          <Box
            component="footer"
            sx={{
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflowX: 'hidden',
              px: { xs: 2, sm: 3, md: 4 },
              py: { xs: 4, md: 5 },
              borderTop: '1px solid rgba(255,255,255,0.12)',
              bgcolor: '#050505',
              backgroundImage: 'none'
            }}
          >
            <Grid container spacing={3} sx={{ width: '100%', maxWidth: 1180, mx: 'auto' }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={1.5}>
                  <Box component="img" src="/brand/logo.svg" alt="Speed Trap Racing" sx={{ width: 220, maxWidth: '100%' }} />
                  <Typography color="text.secondary">Sim racing sessions, food, drinks, and leaderboard nights.</Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={0.75}>
                  <Typography color="primary" sx={{ fontWeight: 950, textTransform: 'uppercase' }}>
                    Visit
                  </Typography>
                  <Typography>Speed Trap Racing</Typography>
                  <Typography color="text.secondary">14718 Detroit Ave. Lakewood, OH 44107</Typography>
                  <Typography color="text.secondary">216-712-4039</Typography>
                  <Typography color="text.secondary">{footerHours}</Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                  sx={{ maxWidth: '100%' }}
                >
                  {footerLinks.map((label) => (
                    <Button
                      key={label}
                      component={Link}
                      href={`/${label.toLowerCase().replaceAll(' ', '-')}`}
                      variant="text"
                      sx={{ color: '#fff', fontWeight: 850 }}
                    >
                      {label}
                    </Button>
                  ))}
                  <Button component={Link} href={bookHref} variant="contained">
                    Book a Race
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
