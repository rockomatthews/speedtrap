'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function NavBar() {
  const supabase = createSupabaseBrowserClient();
  const [isAuthed, setIsAuthed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const navItems = [
    { href: '/pricing', label: 'Pricing' },
    { href: '/race-radar', label: 'Race Radar' },
    ...(isAuthed ? [{ href: '/leaderboards', label: 'Leaderboards' }] : []),
    { href: '/menu', label: 'Menu' },
    { href: '/merch', label: 'Merch' }
  ];

  const authedItems = isAuthed ? [{ href: '/dashboard', label: 'Portal' }] : [];

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const mobileMenu = (
    <Box sx={{ width: 290, bgcolor: '#050505', minHeight: '100%', color: '#fff' }}>
      <Stack spacing={2} sx={{ p: 2 }}>
        <Box component="img" src="/brand/logo.svg" alt="Speed Trap Racing" sx={{ height: 32, width: 'fit-content' }} />
        <List sx={{ p: 0 }}>
          {navItems.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              sx={{ borderRadius: 1, px: 1.5 }}
            >
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 800 }} />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
        {isAuthed ? (
          <Stack spacing={1}>
            {authedItems.map((item) => (
              <Button key={item.href} component={Link} href={item.href} variant="outlined" onClick={() => setMenuOpen(false)}>
                {item.label}
              </Button>
            ))}
            <Button variant="contained" onClick={logout}>
              Logout
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1}>
            <Button component={Link} href="/login" variant="contained" onClick={() => setMenuOpen(false)}>
              Sign Up
            </Button>
            <Button component={Link} href="/login" variant="outlined" onClick={() => setMenuOpen(false)}>
              Sign In
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: '#000',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <Toolbar sx={{ gap: 2, minHeight: { xs: 64, sm: 72 } }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }} aria-label="Home">
          {/* Put your svg at /public/brand/logo.svg */}
          <Box
            component="img"
            src="/brand/logo.svg"
            alt="Speed Trap Racing"
            sx={{ height: { xs: 28, sm: 30 }, width: 'auto', maxWidth: { xs: 190, sm: 240 }, display: 'block' }}
          />
        </Link>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: { xs: 'none', lg: 'flex' }, gap: 0.75, alignItems: 'center' }}>
          {navItems.map((item) => (
            <Button key={item.href} component={Link} href={item.href} color="inherit" sx={{ whiteSpace: 'nowrap' }}>
              {item.label}
            </Button>
          ))}
          <Divider flexItem orientation="vertical" sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 1 }} />
          {isAuthed ? (
            <>
              {authedItems.map((item) => (
                <Button key={item.href} component={Link} href={item.href} color="inherit" sx={{ whiteSpace: 'nowrap' }}>
                  {item.label}
                </Button>
              ))}
              <Button variant="outlined" color="primary" onClick={logout}>
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

        <IconButton
          color="inherit"
          aria-label="Open navigation menu"
          onClick={() => setMenuOpen(true)}
          sx={{ display: { xs: 'inline-flex', lg: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>
      <Drawer anchor="right" open={menuOpen} onClose={() => setMenuOpen(false)} PaperProps={{ sx: { bgcolor: '#050505' } }}>
        {mobileMenu}
      </Drawer>
    </AppBar>
  );
}
