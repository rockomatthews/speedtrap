import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';

import { AppShell } from '@/components/AppShell';
import { EnsureVmsCustomer } from '@/components/EnsureVmsCustomer';
import { BookingsClient } from '@/app/book/ui/BookingsClient';

export default function BookPage() {
  return (
    <AppShell>
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Book
        </Typography>
        <EnsureVmsCustomer />
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
          }}
        >
          <Box sx={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            GET `/api/vms/bookings?past=1&future=1`
          </Box>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Next: calendar + time-slot picker + booking creation.
          </Typography>
        </Paper>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.10)' }} />
        <BookingsClient />
      </Stack>
    </AppShell>
  );
}


