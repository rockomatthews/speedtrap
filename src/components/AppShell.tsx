import Container from '@mui/material/Container';
import type { ContainerProps } from '@mui/material/Container';
import Box from '@mui/material/Box';

import { NavBar } from '@/components/NavBar';

type AppShellProps = {
  children: React.ReactNode;
  containerSx?: ContainerProps['sx'];
  disableGutters?: boolean;
};

export function AppShell({ children, containerSx, disableGutters = false }: AppShellProps) {
  const sx = containerSx ? [{ py: 3 }, ...(Array.isArray(containerSx) ? containerSx : [containerSx])] : { py: 3 };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <NavBar />
      <Container disableGutters={disableGutters} sx={sx}>
        {children}
      </Container>
    </Box>
  );
}

