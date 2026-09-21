import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppShell } from '@/components/AppShell';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';
import { RacingDiscountAdmin } from './ui/RacingDiscountAdmin';

export default async function DiscountsPage() {
  const { role } = await getCurrentUserAndAdminRole();
  return <AppShell><Stack spacing={3}>
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="h4" sx={{ fontWeight: 900 }}>Discount mode</Typography>
      <Button component={Link} href="/admin">Back to Admin</Button>
    </Stack>
    {role === 'admin' ? <RacingDiscountAdmin /> : <Alert severity="warning">Sign in with an admin account to manage discounts.</Alert>}
  </Stack></AppShell>;
}
