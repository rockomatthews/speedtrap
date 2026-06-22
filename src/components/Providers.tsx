'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';

import { theme } from '@/lib/mui/theme';
import { TemporaryBookingDialog } from '@/components/TemporaryBookingDialog';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
        <TemporaryBookingDialog />
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}

