'use client';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import SportsMotorsportsIcon from '@mui/icons-material/SportsMotorsports';

import {
  type VmsDriverLeaderboardPlacement,
  type VmsDriverPublicProfile,
  type VmsLap
} from '@/lib/vms/types';

export type DriverDetail = {
  driver: VmsDriverPublicProfile;
  laps: VmsLap[];
  placements: VmsDriverLeaderboardPlacement[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function statValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  return value;
}

function initials(name: string) {
  return name
    .split(/\s|_/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function DriverRacingProfile({
  detail,
  compact = false
}: {
  detail: DriverDetail;
  compact?: boolean;
}) {
  const { driver, laps, placements } = detail;
  const stats = [
    ['Class', driver.className],
    ['Laps recorded', driver.lapsRecorded],
    ['Last circuit', driver.lastCircuit],
    ['Last vehicle', driver.lastVehicle],
    ['Last visit', formatDate(driver.lastVisit)],
    ['Home venue', driver.homeVenue],
    ['Last group event', driver.lastGroupEvent],
    ['Last race event', driver.lastRaceEvent]
  ] as const;

  return (
    <Stack spacing={2} id={compact ? undefined : 'lap-history'}>
      {compact ? (
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            src={driver.avatarUrl ?? undefined}
            sx={{ width: 64, height: 64, bgcolor: '#151515', color: 'primary.main', border: '2px solid rgba(255,210,0,0.55)' }}
          >
            {driver.avatarUrl ? null : initials(driver.name) || <SportsMotorsportsIcon />}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 950, overflowWrap: 'anywhere' }}>
              {driver.name}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {driver.className ? <Chip size="small" label={driver.className} color="primary" /> : null}
              {driver.homeVenue ? <Chip size="small" label={driver.homeVenue} variant="outlined" /> : null}
            </Stack>
          </Box>
        </Stack>
      ) : null}

      <Grid container spacing={1.25}>
        {stats.map(([label, value]) => (
          <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.12)', bgcolor: 'rgba(0,0,0,0.22)', height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                {label}
              </Typography>
              <Typography sx={{ fontWeight: 900, overflowWrap: 'anywhere' }}>{statValue(value)}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Accordion defaultExpanded={!compact} disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 950 }}>Lap history</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {laps.length === 0 ? (
            <Typography color="text.secondary">No recent VMS laps found for this driver yet.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Lap</TableCell>
                    <TableCell>Track</TableCell>
                    <TableCell>Vehicle</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {laps.map((lap) => (
                    <TableRow key={lap.id}>
                      <TableCell sx={{ fontWeight: 900 }}>{lap.timeStr ?? (lap.timeMs ? `${lap.timeMs} ms` : 'Unknown')}</TableCell>
                      <TableCell>{lap.circuit ?? 'Unknown'}</TableCell>
                      <TableCell>{lap.vehicle ?? 'Unknown'}</TableCell>
                      <TableCell>{formatDate(lap.date)}</TableCell>
                      <TableCell>{lap.invalid ? 'Invalid' : lap.verified ? 'Verified' : 'Recorded'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)', bgcolor: 'rgba(255,255,255,0.02)' }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography sx={{ fontWeight: 950 }}>Leaderboard positions</Typography>
            {placements.length === 0 ? (
              <Typography color="text.secondary">No current site leaderboard placements found for this driver.</Typography>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Rank</TableCell>
                      <TableCell>Challenge</TableCell>
                      <TableCell>Lap</TableCell>
                      <TableCell>Vehicle</TableCell>
                      <TableCell>Venue</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {placements.map((placement) => (
                      <TableRow key={`${placement.eventId}-${placement.subEventId ?? placement.subEventName}`}>
                        <TableCell sx={{ color: 'primary.main', fontWeight: 950 }}>#{placement.rank}</TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 800 }}>{placement.eventName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {placement.subEventName}
                            {placement.circuitName ? ` · ${placement.circuitName}` : ''}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>{placement.lapTimeStr ?? 'Unknown'}</TableCell>
                        <TableCell>{placement.vehicleName ?? 'Unknown'}</TableCell>
                        <TableCell>{placement.venueName ?? 'Unknown'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
