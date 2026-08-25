'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type AdminLeague = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  team_scoring_count: number;
  season_weeks?: number;
  team_count?: number;
  roster_size?: number;
  weekly_fee_cents?: number;
  full_season_fee_cents?: number;
  prize_pool_percent?: number;
  league_start_time?: string;
  league_end_time?: string;
  league_teams?: Array<{ id: string; name: string; color: string; captain_vms_customer_id?: number | null; captain_name?: string | null }>;
  league_members?: Array<{ id: string; driver_name: string; vms_customer_id: number; team_id: string | null; role?: string }>;
  league_rounds?: Array<{
    id: string;
    round_number: number;
    name: string;
    status: string;
    vms_hotlap_events?: { id: string; name: string; vms_hotlap_event_id: number } | null;
  }>;
  league_heats?: Array<{ id: string; round_id: string; heat_number: number; name: string; starts_at: string; ends_at: string; status: string }>;
  league_heat_entries?: Array<{
    id: string;
    round_id: string;
    heat_id: string;
    team_id: string;
    member_id: string | null;
    driver_name: string | null;
    finish_position: number | null;
    points: number;
    result_status: string;
    grid_position: number | null;
  }>;
  league_dues?: Array<{ id: string; member_id: string; week_number: number; amount_cents: number; status: string }>;
  league_prize_ledger?: Array<{ id: string; amount_cents: number; source_type: string; description: string }>;
};

type HotlapEvent = {
  id: string;
  name: string;
  slug: string;
  vms_hotlap_event_id: number;
  circuit_id: number;
  status: string;
};

type DriverSearchResult = {
  id: number;
  name: string;
  className?: string | null;
  lapsRecorded?: number | null;
};

const defaultLeague = {
  name: '',
  slug: '',
  description: '',
  status: 'active',
  visibility: 'public',
  seasonWeeks: 8,
  teamCount: 8,
  rosterSize: 4,
  weeklyFeeCents: 4000,
  fullSeasonFeeCents: 30000,
  prizePoolPercent: 50,
  startsAt: '',
  leagueStartTime: '18:00',
  leagueEndTime: '22:00'
};

export function AdminLeaguesClient() {
  const [leagues, setLeagues] = useState<AdminLeague[]>([]);
  const [events, setEvents] = useState<HotlapEvent[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  const [leagueForm, setLeagueForm] = useState(defaultLeague);
  const [teamForm, setTeamForm] = useState({ name: '', color: '#FFD200' });
  const [memberForm, setMemberForm] = useState({ driverName: '', vmsCustomerId: '', teamId: '', role: 'driver' });
  const [driverQuery, setDriverQuery] = useState('');
  const [driverOptions, setDriverOptions] = useState<DriverSearchResult[]>([]);
  const [driverSearchLoading, setDriverSearchLoading] = useState(false);
  const [roundForm, setRoundForm] = useState({
    roundNumber: '1',
    name: '',
    status: 'qualifying',
    carGroup: '',
    circuitName: '',
    qualifyingHotlapEventId: ''
  });
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedLeague = useMemo(() => leagues.find((league) => league.id === selectedLeagueId) ?? leagues[0], [leagues, selectedLeagueId]);
  const selectedRound = useMemo(() => {
    const rounds = selectedLeague?.league_rounds ?? [];
    return rounds.find((round) => round.id === selectedRoundId) ?? rounds[0] ?? null;
  }, [selectedLeague, selectedRoundId]);

  const selectedRoundHeats = useMemo(() => {
    if (!selectedLeague || !selectedRound) return [];
    return (selectedLeague.league_heats ?? [])
      .filter((heat) => heat.round_id === selectedRound.id)
      .sort((a, b) => a.heat_number - b.heat_number);
  }, [selectedLeague, selectedRound]);

  const prizePoolCents = useMemo(
    () => (selectedLeague?.league_prize_ledger ?? []).reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0),
    [selectedLeague]
  );

  function formatMoney(cents: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  function formatTime(value: string) {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }

  async function load() {
    setError(null);
    const [leagueResponse, eventResponse] = await Promise.all([fetch('/api/admin/leagues'), fetch('/api/vms/hotlap-events')]);
    const leagueJson = await leagueResponse.json();
    const eventJson = await eventResponse.json();
    if (!leagueResponse.ok) throw new Error(leagueJson.error || 'Could not load leagues');
    if (!eventResponse.ok) throw new Error(eventJson.error || 'Could not load VMS hotlap events');
    setLeagues(leagueJson.leagues ?? []);
    setEvents(eventJson.events ?? []);
    if (!selectedLeagueId && leagueJson.leagues?.[0]) setSelectedLeagueId(leagueJson.leagues[0].id);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load leagues'));
  }, []);

  useEffect(() => {
    const query = driverQuery.trim();
    if (query.length < 2) {
      setDriverOptions([]);
      setDriverSearchLoading(false);
      return;
    }

    let cancelled = false;
    setDriverSearchLoading(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/vms/drivers/search?q=${encodeURIComponent(query)}`)
        .then(async (response) => {
          const json = await response.json();
          if (!response.ok) throw new Error(json.error || 'Driver search failed');
          if (!cancelled) setDriverOptions(json.drivers ?? []);
        })
        .catch(() => {
          if (!cancelled) setDriverOptions([]);
        })
        .finally(() => {
          if (!cancelled) setDriverSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [driverQuery]);

  async function submit(path: string, body: unknown, success: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Request failed');
      setMessage(success);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  async function createLeague() {
    await submit('/api/admin/leagues', leagueForm, 'League created.');
    setLeagueForm(defaultLeague);
  }

  async function addTeam() {
    if (!selectedLeague) return;
    await submit(`/api/admin/leagues/${selectedLeague.id}`, { action: 'add-team', ...teamForm }, 'Team added.');
    setTeamForm({ name: '', color: '#FFD200' });
  }

  async function addMember() {
    if (!selectedLeague) return;
    await submit(
      `/api/admin/leagues/${selectedLeague.id}`,
      {
        action: 'add-member',
        driverName: memberForm.driverName,
        vmsCustomerId: memberForm.vmsCustomerId,
        teamId: memberForm.teamId || null,
        role: memberForm.role
      },
      'Driver added.'
    );
    setMemberForm({ driverName: '', vmsCustomerId: '', teamId: '', role: 'driver' });
    setDriverQuery('');
    setDriverOptions([]);
  }

  async function addRound() {
    if (!selectedLeague) return;
    const selectedEvent = events.find((event) => event.id === roundForm.qualifyingHotlapEventId);
    await submit(
      `/api/admin/leagues/${selectedLeague.id}`,
      {
        action: 'add-round',
        roundNumber: roundForm.roundNumber,
        name: roundForm.name,
        status: roundForm.status,
        carGroup: roundForm.carGroup || null,
        circuitId: selectedEvent?.circuit_id ?? null,
        circuitName: roundForm.circuitName || null,
        qualifyingHotlapEventId: roundForm.qualifyingHotlapEventId || null
      },
      'Round added.'
    );
    setRoundForm({ roundNumber: '1', name: '', status: 'qualifying', carGroup: '', circuitName: '', qualifyingHotlapEventId: '' });
  }

  async function leagueAction(body: unknown, success: string) {
    if (!selectedLeague) return;
    await submit(`/api/admin/leagues/${selectedLeague.id}`, body, success);
  }

  async function assignHeatDriver(entryId: string, memberId: string) {
    await leagueAction({ action: 'assign-heat-driver', entryId, memberId: memberId || null }, 'Heat lineup updated.');
  }

  async function updateMemberRole(memberId: string, role: string) {
    await leagueAction({ action: 'update-member-role', memberId, role }, role === 'captain' ? 'Team captain updated.' : 'Driver role updated.');
  }

  async function recordResult(entryId: string, finishPosition: string) {
    await leagueAction(
      {
        action: 'record-heat-result',
        entryId,
        finishPosition: finishPosition ? Number(finishPosition) : null,
        resultStatus: finishPosition ? 'confirmed' : 'scheduled'
      },
      'Heat result saved.'
    );
  }

  async function markDue(memberId: string, weekNumber: number, status: string) {
    await leagueAction({ action: 'mark-due', memberId, weekNumber, status }, 'Dues updated.');
  }

  function dueColor(status?: string): 'primary' | 'success' | 'warning' | 'error' {
    if (status === 'paid') return 'primary';
    if (status === 'waived') return 'success';
    if (status === 'refunded') return 'error';
    return 'warning';
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 1000 }}>
            Leagues
          </Typography>
          <Typography color="text.secondary">Build hybrid leagues from VMS hotlap qualifying, teams, and race-night rounds.</Typography>
        </Box>
        <Button component={Link} href="/admin" variant="contained" color="secondary">
          Back to Admin
        </Button>
      </Stack>

      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box sx={{ p: 3, border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111' }}>
            <Typography variant="h5" sx={{ fontWeight: 1000, mb: 2 }}>
              Create League
            </Typography>
            <Stack spacing={2}>
              <TextField label="League name" value={leagueForm.name} onChange={(e) => setLeagueForm({ ...leagueForm, name: e.target.value })} />
              <TextField label="Slug (optional)" value={leagueForm.slug} onChange={(e) => setLeagueForm({ ...leagueForm, slug: e.target.value })} />
              <TextField
                label="First Tuesday date"
                type="date"
                value={leagueForm.startsAt}
                onChange={(e) => setLeagueForm({ ...leagueForm, startsAt: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Description"
                multiline
                minRows={3}
                value={leagueForm.description}
                onChange={(e) => setLeagueForm({ ...leagueForm, description: e.target.value })}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField select label="Status" fullWidth value={leagueForm.status} onChange={(e) => setLeagueForm({ ...leagueForm, status: e.target.value })}>
                  {['draft', 'active', 'completed', 'archived'].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Visibility"
                  fullWidth
                  value={leagueForm.visibility}
                  onChange={(e) => setLeagueForm({ ...leagueForm, visibility: e.target.value })}
                >
                  {['public', 'members', 'private'].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Weeks"
                    type="number"
                    fullWidth
                    value={leagueForm.seasonWeeks}
                    onChange={(e) => setLeagueForm({ ...leagueForm, seasonWeeks: Number(e.target.value) })}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Teams"
                    type="number"
                    fullWidth
                    value={leagueForm.teamCount}
                    onChange={(e) => setLeagueForm({ ...leagueForm, teamCount: Number(e.target.value) })}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Roster size"
                    type="number"
                    fullWidth
                    value={leagueForm.rosterSize}
                    onChange={(e) => setLeagueForm({ ...leagueForm, rosterSize: Number(e.target.value) })}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Weekly dues"
                    type="number"
                    fullWidth
                    value={leagueForm.weeklyFeeCents / 100}
                    onChange={(e) => setLeagueForm({ ...leagueForm, weeklyFeeCents: Math.round(Number(e.target.value) * 100) })}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Full season"
                    type="number"
                    fullWidth
                    value={leagueForm.fullSeasonFeeCents / 100}
                    onChange={(e) => setLeagueForm({ ...leagueForm, fullSeasonFeeCents: Math.round(Number(e.target.value) * 100) })}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Start time"
                    type="time"
                    fullWidth
                    value={leagueForm.leagueStartTime}
                    onChange={(e) => setLeagueForm({ ...leagueForm, leagueStartTime: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="End time"
                    type="time"
                    fullWidth
                    value={leagueForm.leagueEndTime}
                    onChange={(e) => setLeagueForm({ ...leagueForm, leagueEndTime: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>
              <Button disabled={loading || !leagueForm.name.trim()} onClick={createLeague} variant="contained">
                Create League
              </Button>
            </Stack>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={3}>
            <Box sx={{ p: 3, border: '1px solid rgba(255,210,0,0.35)', bgcolor: '#111' }}>
              <Typography variant="h5" sx={{ fontWeight: 1000, mb: 2 }}>
                Manage League
              </Typography>
              <Stack spacing={2}>
                <TextField select label="League" value={selectedLeague?.id ?? ''} onChange={(e) => setSelectedLeagueId(e.target.value)}>
                  {leagues.map((league) => (
                    <MenuItem key={league.id} value={league.id}>
                      {league.name}
                    </MenuItem>
                  ))}
                </TextField>
                {selectedLeague ? (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={selectedLeague.status} />
                    <Chip label={`${selectedLeague.league_teams?.length ?? 0} teams`} />
                    <Chip label={`${selectedLeague.league_members?.length ?? 0} drivers`} />
                    <Chip label={`${selectedLeague.league_rounds?.length ?? 0} rounds`} />
                    <Chip label={`${selectedLeague.season_weeks ?? 8} weeks`} />
                    <Chip label={`${formatMoney(selectedLeague.weekly_fee_cents ?? 4000)}/week`} />
                    <Chip label={`Prize pool ${formatMoney(prizePoolCents)}`} color="primary" />
                    <Button component={Link} href={`/leagues/${selectedLeague.slug}`} size="small">
                      View public page
                    </Button>
                  </Stack>
                ) : null}
              </Stack>
            </Box>

            {selectedLeague ? (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 3, border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111', height: '100%' }}>
                    <Typography variant="h6" sx={{ fontWeight: 1000, mb: 2 }}>
                      Add Team
                    </Typography>
                    <Stack spacing={2}>
                      <Alert severity="info">
                        Create the team first, then add the captain below with role Captain. The captain can rename the team from the public league page.
                      </Alert>
                      <TextField label="Team name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
                      <TextField label="Color" value={teamForm.color} onChange={(e) => setTeamForm({ ...teamForm, color: e.target.value })} />
                      <Button disabled={loading || !teamForm.name.trim()} onClick={addTeam} variant="contained">
                        Add Team
                      </Button>
                    </Stack>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 3, border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111', height: '100%' }}>
                    <Typography variant="h6" sx={{ fontWeight: 1000, mb: 2 }}>
                      Add / Place Driver
                    </Typography>
                    <Stack spacing={2}>
                      <Alert severity="info">
                        Customers do not need to know a VMS number. Search VMS by driver name, assign the team and role, then use Weekly Dues
                        for paid or waived house seats.
                      </Alert>
                      <Autocomplete
                        options={driverOptions}
                        loading={driverSearchLoading}
                        inputValue={driverQuery}
                        onInputChange={(_, value) => setDriverQuery(value)}
                        getOptionLabel={(option) => option.name}
                        filterOptions={(options) => options}
                        noOptionsText={driverQuery.trim().length < 2 ? 'Type at least 2 letters' : 'No VMS drivers found'}
                        onChange={(_, option) => {
                          if (!option) return;
                          setMemberForm({
                            ...memberForm,
                            driverName: option.name,
                            vmsCustomerId: String(option.id)
                          });
                        }}
                        renderOption={(props, option) => (
                          <Box component="li" {...props} key={option.id}>
                            <Stack spacing={0.25}>
                              <Typography sx={{ fontWeight: 900 }}>{option.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                VMS Driver ID {option.id}
                                {option.className ? ` · ${option.className}` : ''}
                                {option.lapsRecorded ? ` · ${option.lapsRecorded} laps` : ''}
                              </Typography>
                            </Stack>
                          </Box>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Find VMS driver"
                            helperText="Search by driver name. Selecting a result fills the staff-only VMS Driver ID."
                          />
                        )}
                      />
                      <TextField label="Driver name" value={memberForm.driverName} onChange={(e) => setMemberForm({ ...memberForm, driverName: e.target.value })} />
                      <TextField
                        label="VMS Driver ID (staff only)"
                        type="number"
                        value={memberForm.vmsCustomerId}
                        helperText="Internal VMS customer number. Staff can look it up from VMS or by using the search above."
                        onChange={(e) => setMemberForm({ ...memberForm, vmsCustomerId: e.target.value })}
                      />
                      <TextField select label="Team" value={memberForm.teamId} onChange={(e) => setMemberForm({ ...memberForm, teamId: e.target.value })}>
                        <MenuItem value="">Independent</MenuItem>
                        {(selectedLeague.league_teams ?? []).map((team) => (
                          <MenuItem key={team.id} value={team.id}>
                            {team.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField select label="Role" value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}>
                        <MenuItem value="driver">Driver</MenuItem>
                        <MenuItem value="captain">Captain</MenuItem>
                        <MenuItem value="substitute">Substitute</MenuItem>
                      </TextField>
                      <Button disabled={loading || !memberForm.driverName.trim() || !memberForm.vmsCustomerId} onClick={addMember} variant="contained">
                        Add Driver
                      </Button>
                    </Stack>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 3, border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111' }}>
                    <Typography variant="h6" sx={{ fontWeight: 1000, mb: 2 }}>
                      Add Round
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 2 }}>
                        <TextField
                          label="Round"
                          type="number"
                          fullWidth
                          value={roundForm.roundNumber}
                          onChange={(e) => setRoundForm({ ...roundForm, roundNumber: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 5 }}>
                        <TextField label="Round name" fullWidth value={roundForm.name} onChange={(e) => setRoundForm({ ...roundForm, name: e.target.value })} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 5 }}>
                        <TextField
                          label="Car type / class"
                          fullWidth
                          value={roundForm.carGroup}
                          onChange={(e) => setRoundForm({ ...roundForm, carGroup: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          select
                          label="Qualifying VMS hotlap event"
                          fullWidth
                          value={roundForm.qualifyingHotlapEventId}
                          onChange={(e) => {
                            const selected = events.find((event) => event.id === e.target.value);
                            setRoundForm({ ...roundForm, qualifyingHotlapEventId: e.target.value, circuitName: selected ? `Circuit #${selected.circuit_id}` : '' });
                          }}
                        >
                          <MenuItem value="">No qualifying event yet</MenuItem>
                          {events.map((event) => (
                            <MenuItem key={event.id} value={event.id}>
                              {event.name} ({event.status})
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          select
                          label="Round status"
                          fullWidth
                          value={roundForm.status}
                          onChange={(e) => setRoundForm({ ...roundForm, status: e.target.value })}
                        >
                          {['draft', 'qualifying', 'race-night', 'completed', 'cancelled'].map((value) => (
                            <MenuItem key={value} value={value}>
                              {value}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Button disabled={loading || !roundForm.name.trim()} onClick={addRound} variant="contained">
                          Add Round
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 3, border: '1px solid rgba(255,210,0,0.35)', bgcolor: '#111' }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 3 }}>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 1000 }}>
                          Race Night Ops
                        </Typography>
                        <Typography color="text.secondary">
                          Generate the 8-week schedule, assign each team's driver to a heat, then enter 4/3/2/1 results.
                        </Typography>
                      </Box>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button
                          disabled={loading || (selectedLeague.league_teams?.length ?? 0) < (selectedLeague.team_count ?? 8)}
                          onClick={() => leagueAction({ action: 'generate-season' }, '8-week heat schedule generated.')}
                          variant="contained"
                        >
                          Generate Season
                        </Button>
                        <Button
                          disabled={loading || (selectedLeague.league_members?.length ?? 0) === 0}
                          onClick={() => leagueAction({ action: 'seed-dues' }, 'Weekly dues seeded.')}
                          variant="outlined"
                        >
                          Seed Dues
                        </Button>
                      </Stack>
                    </Stack>

                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                          <Typography color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 12 }}>
                            Format
                          </Typography>
                          <Typography sx={{ fontWeight: 1000 }}>
                            {selectedLeague.team_count ?? 8} teams x {selectedLeague.roster_size ?? 4} drivers
                          </Typography>
                          <Typography color="text.secondary">8 heats, 30 minutes each, Tuesday nights.</Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                          <Typography color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 12 }}>
                            Scoring
                          </Typography>
                          <Typography sx={{ fontWeight: 1000 }}>4 / 3 / 2 / 1</Typography>
                          <Typography color="text.secondary">Top driver in each heat earns 4 points for their team.</Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                          <Typography color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 12 }}>
                            Dues
                          </Typography>
                          <Typography sx={{ fontWeight: 1000 }}>{formatMoney(selectedLeague.weekly_fee_cents ?? 4000)} / driver / week</Typography>
                          <Typography color="text.secondary">Prize ledger tracks the configured contribution.</Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {(selectedLeague.league_rounds ?? []).length > 0 ? (
                      <TextField
                        select
                        label="Race week"
                        fullWidth
                        sx={{ mb: 3 }}
                        value={selectedRound?.id ?? ''}
                        onChange={(e) => setSelectedRoundId(e.target.value)}
                      >
                        {(selectedLeague.league_rounds ?? [])
                          .slice()
                          .sort((a, b) => a.round_number - b.round_number)
                          .map((round) => (
                            <MenuItem key={round.id} value={round.id}>
                              Week {round.round_number}: {round.name}
                            </MenuItem>
                          ))}
                      </TextField>
                    ) : null}

                    <Stack spacing={2}>
                      {selectedRoundHeats.map((heat) => {
                        const entries = (selectedLeague.league_heat_entries ?? [])
                          .filter((entry) => entry.heat_id === heat.id)
                          .sort((a, b) => (a.grid_position ?? 99) - (b.grid_position ?? 99));
                        return (
                          <Box key={heat.id} sx={{ p: 2, border: '1px solid rgba(255,255,255,0.12)', bgcolor: 'rgba(255,255,255,0.035)' }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
                              <Typography sx={{ fontWeight: 1000 }}>
                                {heat.name} · {formatTime(heat.starts_at)} - {formatTime(heat.ends_at)}
                              </Typography>
                              <Chip label={heat.status} size="small" />
                            </Stack>
                            <Grid container spacing={1.5}>
                              {entries.map((entry) => {
                                const team = (selectedLeague.league_teams ?? []).find((row) => row.id === entry.team_id);
                                const teamDrivers = (selectedLeague.league_members ?? []).filter((member) => member.team_id === entry.team_id);
                                return (
                                  <Grid key={entry.id} size={{ xs: 12, md: 6 }}>
                                    <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.1)', bgcolor: '#0b0b0b' }}>
                                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                        <Box sx={{ width: 10, height: 10, bgcolor: team?.color ?? '#FFD200' }} />
                                        <Typography sx={{ fontWeight: 900 }}>{team?.name ?? 'Team'}</Typography>
                                        <Chip label={`${entry.points} pts`} size="small" color={entry.points > 0 ? 'primary' : 'default'} />
                                      </Stack>
                                      <Grid container spacing={1}>
                                        <Grid size={{ xs: 12, sm: 8 }}>
                                          <TextField
                                            select
                                            size="small"
                                            label="Driver"
                                            fullWidth
                                            value={entry.member_id ?? ''}
                                            onChange={(event) => void assignHeatDriver(entry.id, event.target.value)}
                                          >
                                            <MenuItem value="">Choose driver</MenuItem>
                                            {teamDrivers.map((driver) => (
                                              <MenuItem key={driver.id} value={driver.id}>
                                                {driver.driver_name}
                                              </MenuItem>
                                            ))}
                                          </TextField>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                          <TextField
                                            select
                                            size="small"
                                            label="Finish"
                                            fullWidth
                                            value={entry.finish_position ?? ''}
                                            onChange={(event) => void recordResult(entry.id, event.target.value)}
                                          >
                                            <MenuItem value="">--</MenuItem>
                                            {[1, 2, 3, 4].map((position) => (
                                              <MenuItem key={position} value={position}>
                                                P{position}
                                              </MenuItem>
                                            ))}
                                          </TextField>
                                        </Grid>
                                      </Grid>
                                    </Box>
                                  </Grid>
                                );
                              })}
                            </Grid>
                          </Box>
                        );
                      })}
                      {selectedLeague.league_heats?.length === 0 || !selectedLeague.league_heats ? (
                        <Alert severity="info">Add 8 teams, then generate the season to create Tuesday heat lineups.</Alert>
                      ) : null}
                    </Stack>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 3, border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111' }}>
                    <Typography variant="h5" sx={{ fontWeight: 1000, mb: 2 }}>
                      Weekly Dues
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Paid adds the configured prize-pool contribution. Waived covers house/comped seats without adding prize-pool money.
                    </Alert>
                    <Grid container spacing={1.5}>
                      {(selectedLeague.league_members ?? []).map((member) => {
                        const coveredCount = (selectedLeague.league_dues ?? []).filter(
                          (due) => due.member_id === member.id && (due.status === 'paid' || due.status === 'waived')
                        ).length;
                        const team = (selectedLeague.league_teams ?? []).find((row) => row.id === member.team_id);
                        return (
                          <Grid key={member.id} size={{ xs: 12, md: 6 }}>
                            <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.04)' }}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
                                <Box>
                                  <Typography sx={{ fontWeight: 1000 }}>{member.driver_name}</Typography>
                                  <Typography color="text.secondary">
                                    {team?.name ?? 'Independent'} · VMS Driver ID {member.vms_customer_id} · {coveredCount}/
                                    {selectedLeague.season_weeks ?? 8} weeks covered
                                  </Typography>
                                </Box>
                                <TextField
                                  select
                                  size="small"
                                  label="Role"
                                  value={member.role ?? 'driver'}
                                  onChange={(event) => void updateMemberRole(member.id, event.target.value)}
                                  sx={{ minWidth: 150 }}
                                >
                                  <MenuItem value="driver">Driver</MenuItem>
                                  <MenuItem value="captain" disabled={!member.team_id}>
                                    Captain
                                  </MenuItem>
                                  <MenuItem value="substitute">Substitute</MenuItem>
                                </TextField>
                              </Stack>
                              <Grid container spacing={1}>
                                {Array.from({ length: selectedLeague.season_weeks ?? 8 }, (_, index) => {
                                  const weekNumber = index + 1;
                                  const due = (selectedLeague.league_dues ?? []).find((row) => row.member_id === member.id && row.week_number === weekNumber);
                                  const status = due?.status ?? 'pending';
                                  return (
                                    <Grid key={weekNumber} size={{ xs: 6, sm: 4, md: 3 }}>
                                      <TextField
                                        select
                                        size="small"
                                        fullWidth
                                        label={`W${weekNumber}`}
                                        value={status}
                                        color={dueColor(status)}
                                        onChange={(event) => void markDue(member.id, weekNumber, event.target.value)}
                                      >
                                        <MenuItem value="pending">Pending</MenuItem>
                                        <MenuItem value="paid">Paid</MenuItem>
                                        <MenuItem value="waived">Waived</MenuItem>
                                        <MenuItem value="refunded">Refunded</MenuItem>
                                      </TextField>
                                    </Grid>
                                  );
                                })}
                              </Grid>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            ) : null}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
