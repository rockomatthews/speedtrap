import Container from '@mui/material/Container';
import Box from '@mui/material/Box';

import { NavBar } from '@/components/NavBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <NavBar />
      <Container sx={{ py: 3 }}>{children}</Container>
    </Box>
  );
}


