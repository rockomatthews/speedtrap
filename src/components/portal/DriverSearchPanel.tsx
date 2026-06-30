'use client';

import { useEffect, useMemo, useState } from 'react';

import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SportsMotorsportsIcon from '@mui/icons-material/SportsMotorsports';

import { DriverRacingProfile, type DriverDetail } from '@/components/portal/DriverRacingProfile';
import { type VmsDriverPublicProfile } from '@/lib/vms/types';

function initials(name: string) {
  return name
    .split(/\s|_/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function DriverSearchPanel() {
  const [query, setQuery] = useState('');
  const [drivers, setDrivers] = useState<VmsDriverPublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DriverDetail | null>(null);
  const debouncedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (debouncedQuery.length < 2) {
        setDrivers([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      setError(null);
      try {
        const res = await fetch(`/api/vms/drivers/search?q=${encodeURIComponent(debouncedQuery)}`, {
          signal: controller.signal
        });
        const json = (await res.json().catch(() => null)) as { drivers?: VmsDriverPublicProfile[]; error?: string } | null;
        if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
        setDrivers(json?.drivers ?? []);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Failed to search drivers.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [debouncedQuery]);

  async function selectDriver(driver: VmsDriverPublicProfile) {
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await fetch(`/api/vms/drivers/${driver.id}?lapCount=12`);
      const json = (await res.json().catch(() => null)) as DriverDetail & { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      if (!json?.driver) throw new Error('Driver details were not returned.');
      setSelected({ driver: json.driver, laps: json.laps ?? [], placements: json.placements ?? [] });
      setQuery('');
      setDrivers([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load driver details.');
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <Stack spacing={1.5}>
      <Box sx={{ position: 'relative', width: { xs: '100%', md: 420 }, ml: { md: 'auto' } }}>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search drivers"
          fullWidth
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searching ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ) : null
            }
          }}
        />

        {drivers.length > 0 ? (
          <Paper
            elevation={8}
            sx={{
              position: 'absolute',
              zIndex: 5,
              left: 0,
              right: 0,
              mt: 0.75,
              border: '1px solid rgba(255,210,0,0.22)',
              bgcolor: '#101010',
              overflow: 'hidden'
            }}
          >
            <List dense disablePadding>
              {drivers.map((driver) => (
                <ListItemButton key={driver.id} onClick={() => void selectDriver(driver)}>
                  <ListItemAvatar>
                    <Avatar src={driver.avatarUrl ?? undefined} sx={{ bgcolor: 'primary.main', color: 'common.black' }}>
                      {driver.avatarUrl ? null : initials(driver.name) || <SportsMotorsportsIcon />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={driver.name}
                    secondary={[driver.className, driver.lastCircuit].filter(Boolean).join(' · ') || 'Speed Trap driver'}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        ) : null}
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {selected ? (
        <Card variant="outlined" sx={{ borderColor: 'rgba(255,210,0,0.45)' }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label="Driver Spotlight" color="primary" sx={{ fontWeight: 950 }} />
                  {loadingDetail ? <CircularProgress size={16} /> : null}
                </Stack>
                <IconButton size="small" aria-label="Close driver spotlight" onClick={() => setSelected(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              <DriverRacingProfile detail={selected} compact />
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: { xs: 'left', md: 'right' } }}>
          Search by racing name to view driver laps and leaderboard spots.
        </Typography>
      )}
    </Stack>
  );
}
