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

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return 'TBD';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default async function LeagueDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const standings = await getLeagueStandings(slug);
  const { league, rounds, driverStandings, teamStandings } = standings;

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
            <Chip label={`Team scoring: best ${league.team_scoring_count}`} variant="outlined" />
          </Stack>
          <Typography variant="h2" sx={{ fontSize: { xs: 44, md: 72 }, fontWeight: 1000, lineHeight: 0.95 }}>
            {league.name}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 860, fontSize: 19 }}>
            {league.description || 'Qualifying hotlaps feed the standings now; race-night results can be linked as each round goes live.'}
          </Typography>
        </Box>

        {standings.errors.map((error) => (
          <Alert key={error} severity="warning">
            {error}
          </Alert>
        ))}

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
                    <TableCell align="right">Best</TableCell>
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
                      <TableCell align="right">{driver.bestRank ? `P${driver.bestRank}` : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {driverStandings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>No VMS qualifying results yet.</TableCell>
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
                      <Typography sx={{ fontWeight: 1000 }}>{team.points}</Typography>
                    </Box>
                  ))}
                  {teamStandings.length === 0 ? <Typography color="text.secondary">No teams scored yet.</Typography> : null}
                </Stack>
              </Box>

              <Box sx={{ border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111', p: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 1000, mb: 2 }}>
                  Rounds
                </Typography>
                <Stack spacing={1.5}>
                  {rounds.map((round) => (
                    <Box key={round.id} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)' }}>
                      <Typography sx={{ fontWeight: 1000 }}>
                        Round {round.round_number}: {round.name}
                      </Typography>
                      <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                        {round.car_group || 'Open class'} {round.circuit_name ? `- ${round.circuit_name}` : ''}
                      </Typography>
                      {round.vms_hotlap_events ? (
                        <Button component={Link} href={`/leaderboards/${round.vms_hotlap_events.slug}`} size="small" sx={{ mt: 1 }}>
                          VMS Qualifying Board
                        </Button>
                      ) : null}
                    </Box>
                  ))}
                  {rounds.length === 0 ? <Typography color="text.secondary">No rounds configured yet.</Typography> : null}
                </Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </AppShell>
  );
}
