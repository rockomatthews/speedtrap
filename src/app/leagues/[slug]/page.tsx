import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { getLeagueStandings } from '@/lib/leagues/standings';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { LeagueRegistrationCard } from './LeagueRegistrationCard';
import { LeagueCaptainTeamName } from './LeagueCaptainTeamName';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return 'TBD';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeagueDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = (await searchParams) ?? {};
  const standings = await getLeagueStandings(slug);
  const { league, rounds, teams, members, heats, heatEntries, dues, prizeLedger, driverStandings, teamStandings } = standings;
  const prizePoolCents = prizeLedger.reduce((sum, row) => sum + row.amount_cents, 0);
  const { user, profile } = await getAuthedProfile();
  const supabase = createSupabaseAdminClient();
  const { data: registrations } = await supabase
    .from('league_registrations')
    .select('id,status,profile_id,vms_customer_id')
    .eq('league_id', league.id)
    .in('status', ['pending_payment', 'registered']);
  const reservedCount = Math.max(
    members.length,
    (registrations ?? []).filter((registration) => ['pending_payment', 'registered'].includes(registration.status)).length
  );
  const userRegistration =
    profile && registrations
      ? registrations.find(
          (registration) =>
            registration.profile_id === profile.id ||
            (profile.vms_customer_id != null && Number(registration.vms_customer_id) === Number(profile.vms_customer_id))
        )
      : null;
  const registrationState = queryValue(query.league_registered);
  const loginHref = `/login?redirectTo=${encodeURIComponent(`/leagues/${league.slug}`)}`;
  const metadataName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  const defaultDriverName = profile?.display_name?.trim() || metadataName || user?.email?.split('@')[0] || '';

  return (
    <AppShell>
      <Stack spacing={4}>
        <Box>
          <Button component={Link} href="/leagues" variant="text" sx={{ mb: 2 }}>
            Back to Leagues
          </Button>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Chip label={league.status} color={league.status === 'active' ? 'primary' : 'default'} />
            <Chip label={`${formatDate(league.starts_at)} - ${formatDate(league.ends_at)}`} variant="outlined" />
            <Chip label={`${league.team_count} teams x ${league.roster_size} drivers`} variant="outlined" />
            <Chip label={`${formatMoney(league.weekly_fee_cents)} / week`} variant="outlined" />
            <Chip label={`Prize pool ${formatMoney(prizePoolCents)}`} color="secondary" />
          </Stack>
          <Typography variant="h2" sx={{ fontSize: { xs: 44, md: 72 }, fontWeight: 1000, lineHeight: 0.95 }}>
            {league.name}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 860, fontSize: 19 }}>
            {league.description || 'Eight weeks of Tuesday night heats. Every driver races one 30-minute heat each week, and every finish scores for the team.'}
          </Typography>
        </Box>

        <LeagueRegistrationCard
          leagueSlug={league.slug}
          signedIn={Boolean(user)}
          loginHref={loginHref}
          alreadyRegistered={Boolean(userRegistration)}
          registrationStatus={userRegistration?.status ?? null}
          capacity={league.team_count * league.roster_size}
          registeredCount={reservedCount}
          weeklyFeeCents={league.weekly_fee_cents}
          fullSeasonFeeCents={league.full_season_fee_cents}
          seasonWeeks={league.season_weeks}
          defaultDriverName={defaultDriverName}
          success={registrationState === 'success'}
          cancelled={registrationState === 'cancelled'}
        />

        <Grid container spacing={2}>
          {[
            ['Format', `${league.season_weeks} weeks · ${league.team_count} teams`],
            ['Race Night', `${league.league_night} · ${league.league_start_time.slice(0, 5)}-${league.league_end_time.slice(0, 5)}`],
            ['Heat Scoring', 'P1 4 pts · P2 3 · P3 2 · P4 1'],
            ['Drivers', `${reservedCount}/${league.team_count * league.roster_size} reserved`]
          ].map(([label, value]) => (
            <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Box sx={{ p: 2.5, border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111' }}>
                <Typography color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 12 }}>
                  {label}
                </Typography>
                <Typography sx={{ fontWeight: 1000, fontSize: 22 }}>{value}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {standings.errors.map((error) => (
          <Alert key={error} severity="warning">
            {error}
          </Alert>
        ))}

        <LeagueCaptainTeamName leagueSlug={league.slug} />

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Box sx={{ border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111', overflow: 'hidden' }}>
              <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography variant="h4" sx={{ fontWeight: 1000 }}>
                  Driver Standings
                </Typography>
              </Box>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Pos</TableCell>
                    <TableCell>Driver</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell align="right">Pts</TableCell>
                    <TableCell align="right">Starts</TableCell>
                    <TableCell align="right">Wins</TableCell>
                    <TableCell align="right">Avg</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {driverStandings.map((driver, index) => (
                    <TableRow key={driver.vmsCustomerId}>
                      <TableCell sx={{ color: 'primary.main', fontWeight: 1000 }}>{index + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>{driver.driverName}</TableCell>
                      <TableCell>
                        {driver.teamName ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 10, height: 10, bgcolor: driver.teamColor ?? '#FFD200' }} />
                            <span>{driver.teamName}</span>
                          </Stack>
                        ) : (
                          'Independent'
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 1000 }}>
                        {driver.points}
                      </TableCell>
                      <TableCell align="right">{driver.starts || driver.roundsScored}</TableCell>
                      <TableCell align="right">{driver.wins}</TableCell>
                      <TableCell align="right">{driver.averageFinish ? driver.averageFinish.toFixed(1) : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {driverStandings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>No heat results yet.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <Stack spacing={3}>
              <Box sx={{ border: '1px solid rgba(255,210,0,0.45)', bgcolor: '#111', p: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 1000, mb: 2 }}>
                  Team Standings
                </Typography>
                <Stack spacing={1.5}>
                  {teamStandings.map((team, index) => (
                    <Box key={team.teamId} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.04)' }}>
                      <Typography sx={{ color: 'primary.main', fontWeight: 1000, width: 24 }}>{index + 1}</Typography>
                      <Box sx={{ width: 12, height: 12, bgcolor: team.teamColor }} />
                      <Typography sx={{ flex: 1, fontWeight: 900 }}>{team.teamName}</Typography>
                      <Typography sx={{ color: 'text.secondary' }}>{team.wins} wins</Typography>
                      <Typography sx={{ fontWeight: 1000, minWidth: 42, textAlign: 'right' }}>{team.points}</Typography>
                    </Box>
                  ))}
                  {teamStandings.length === 0 ? <Typography color="text.secondary">No teams scored yet.</Typography> : null}
                </Stack>
              </Box>

              <Box sx={{ border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111', p: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 1000, mb: 2 }}>
                  Teams
                </Typography>
                <Stack spacing={1.5}>
                  {teams.map((team) => {
                    const roster = members.filter((member) => member.team_id === team.id);
                    return (
                      <Box key={team.id} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 12, height: 12, bgcolor: team.color }} />
                          <Typography sx={{ fontWeight: 1000 }}>{team.name}</Typography>
                          <Chip label={`${roster.length}/${league.roster_size}`} size="small" />
                          {team.captain_name ? <Chip label={`Captain: ${team.captain_name}`} size="small" color="primary" variant="outlined" /> : null}
                        </Stack>
                        <Typography color="text.secondary" sx={{ mt: 1 }}>
                          {roster.length
                            ? roster.map((member) => `${member.driver_name}${member.role === 'captain' ? ' (Captain)' : ''}`).join(', ')
                            : 'Roster coming soon'}
                        </Typography>
                      </Box>
                    );
                  })}
                  {teams.length === 0 ? <Typography color="text.secondary">No teams configured yet.</Typography> : null}
                </Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>

        <Box sx={{ border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111', overflow: 'hidden' }}>
          <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="h4" sx={{ fontWeight: 1000 }}>
              Weekly Heat Schedule
            </Typography>
          </Box>
          <Stack spacing={0}>
            {rounds.map((round) => {
              const roundHeats = heats.filter((heat) => heat.round_id === round.id).sort((a, b) => a.heat_number - b.heat_number);
              return (
                <Box key={round.id} sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 1000 }}>
                      Week {round.round_number}: {round.name}
                    </Typography>
                    <Typography color="text.secondary">{round.race_starts_at ? formatDate(round.race_starts_at) : 'Date TBD'}</Typography>
                  </Stack>
                  <Grid container spacing={1.5}>
                    {roundHeats.map((heat) => {
                      const entries = heatEntries
                        .filter((entry) => entry.heat_id === heat.id)
                        .sort((a, b) => (a.finish_position ?? a.grid_position ?? 99) - (b.finish_position ?? b.grid_position ?? 99));
                      return (
                        <Grid key={heat.id} size={{ xs: 12, md: 6, xl: 3 }}>
                          <Box sx={{ p: 2, height: '100%', border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.035)' }}>
                            <Typography sx={{ fontWeight: 1000 }}>
                              {heat.name} · {formatTime(heat.starts_at)}
                            </Typography>
                            <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                              {entries.map((entry) => {
                                const team = teams.find((row) => row.id === entry.team_id);
                                return (
                                  <Stack key={entry.id} direction="row" spacing={1} alignItems="center">
                                    <Box sx={{ width: 8, height: 8, bgcolor: team?.color ?? '#FFD200' }} />
                                    <Typography sx={{ flex: 1, fontSize: 14 }}>{entry.driver_name || team?.name || 'TBD'}</Typography>
                                    <Typography sx={{ color: 'primary.main', fontWeight: 1000, fontSize: 14 }}>
                                      {entry.finish_position ? `P${entry.finish_position}` : ''}
                                    </Typography>
                                  </Stack>
                                );
                              })}
                            </Stack>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              );
            })}
            {rounds.length === 0 ? <Box sx={{ p: 3 }}>No race weeks configured yet.</Box> : null}
          </Stack>
        </Box>
      </Stack>
    </AppShell>
  );
}
