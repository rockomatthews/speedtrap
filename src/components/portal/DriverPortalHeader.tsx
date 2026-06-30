'use client';

import { useState } from 'react';

import CloseIcon from '@mui/icons-material/Close';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DriverRacingProfile, type DriverDetail } from '@/components/portal/DriverRacingProfile';
import { DriverSearchPanel } from '@/components/portal/DriverSearchPanel';

export function DriverPortalHeader({ email }: { email?: string | null }) {
  const [selectedDriver, setSelectedDriver] = useState<DriverDetail | null>(null);

  return (
    <Stack spacing={2}>
      <Grid container spacing={2} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Driver Portal
            </Typography>
            <Typography color="text.secondary">Signed in as {email ?? 'unknown'}.</Typography>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <DriverSearchPanel onDriverSelected={setSelectedDriver} />
        </Grid>
      </Grid>

      {selectedDriver ? (
        <Card variant="outlined" sx={{ borderColor: 'rgba(255,210,0,0.45)', width: '100%' }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label="Driver Spotlight" color="primary" sx={{ fontWeight: 950 }} />
                </Stack>
                <IconButton size="small" aria-label="Close driver spotlight" onClick={() => setSelectedDriver(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              <DriverRacingProfile detail={selectedDriver} compact />
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
