'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Toolbar from '@mui/material/Toolbar';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function NavBar() {
  const supabase = createSupabaseBrowserClient();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setIsAuthed(Boolean(data.session));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session));
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase.auth]);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: '#000',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }} aria-label="Home">
          {/* Put your svg at /public/brand/logo.svg */}
          <Box
            component="img"
            src="/brand/logo.svg"
            alt="Speed Trap Racing"
            sx={{ height: 30, width: 'auto', display: 'block' }}
          />
        </Link>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center' }}>
          <Button component={Link} href="/how-it-works" color="inherit">
            How It Works
          </Button>
          <Button component={Link} href="/pricing" color="inherit">
            Pricing
          </Button>
          <Button component={Link} href="/race-radar" color="inherit">
            Race Radar
          </Button>
          <Divider flexItem orientation="vertical" sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 1 }} />
          {isAuthed ? (
            <>
              <Button component={Link} href="/dashboard" color="inherit">
                Portal
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/login';
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="contained" color="primary" component={Link} href="/login">
                Sign Up
              </Button>
              <Button variant="outlined" color="primary" component={Link} href="/login">
                Sign In
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}


