import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function formatWindow(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return 'Schedule coming soon';
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  return `${startsAt ? formatter.format(new Date(startsAt)) : 'TBD'} - ${endsAt ? formatter.format(new Date(endsAt)) : 'TBD'}`;
}

export default async function LeaguesPage() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('leagues')
    .select('*, league_teams(id), league_rounds(id)')
    .in('status', ['active', 'completed'])
    .eq('visibility', 'public')
    .order('starts_at', { ascending: false, nullsFirst: false });

  return (
    <AppShell>
      <Stack spacing={4}>
        <Box>
          <Chip label="Leagues" sx={{ mb: 2, fontWeight: 900 }} />
          <Typography variant="h2" sx={{ maxWidth: 920, fontSize: { xs: 46, md: 76 }, fontWeight: 1000, lineHeight: 0.92 }}>
            Qualify, team up, then race for the table.
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 760, fontSize: 20 }}>
            Speed Trap leagues use VMS timing for qualifying laps and race-night results while teams, rounds, and standings live here.
          </Typography>
        </Box>

        {error ? <Alert severity="error">{error.message}</Alert> : null}

        <Grid container spacing={3}>
          {(data ?? []).map((league: any) => (
            <Grid key={league.id} size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  height: '100%',
                  p: { xs: 3, md: 4 },
                  border: '1px solid rgba(255,210,0,0.45)',
                  bgcolor: '#111',
                  background: 'linear-gradient(135deg, rgba(255,210,0,0.12), rgba(255,22,31,0.08) 55%, rgba(0,0,0,0.9))'
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={league.status} size="small" color={league.status === 'active' ? 'primary' : 'default'} />
                    <Chip label={formatWindow(league.starts_at, league.ends_at)} size="small" variant="outlined" />
                  </Stack>
                  <Typography variant="h4" sx={{ fontWeight: 1000 }}>
                    {league.name}
                  </Typography>
                  <Typography color="text.secondary">{league.description || 'League details are being staged.'}</Typography>
                  <Stack direction="row" spacing={3} sx={{ color: 'text.secondary' }}>
                    <Typography>
                      <b>{league.league_teams?.length ?? 0}</b> teams
                    </Typography>
                    <Typography>
                      <b>{league.league_rounds?.length ?? 0}</b> rounds
                    </Typography>
                  </Stack>
                  <Button component={Link} href={`/leagues/${league.slug}`} variant="contained" sx={{ alignSelf: 'flex-start' }}>
                    View League
                  </Button>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>

        {!error && (data ?? []).length === 0 ? (
          <Alert severity="info">No active public leagues yet. Staff can create one from Admin.</Alert>
        ) : null}
      </Stack>
    </AppShell>
  );
}
