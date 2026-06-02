'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { type RaceRadarPost } from '@/lib/race-radar/types';

export function RaceRadarClient() {
  const [posts, setPosts] = useState<RaceRadarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch('/api/race-radar/posts');
        const json = (await res.json().catch(() => null)) as { posts?: RaceRadarPost[]; error?: string } | null;
        if (!res.ok) throw new Error(json?.error ?? 'Failed to load Race Radar.');
        if (!cancelled) setPosts(json?.posts ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load Race Radar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (loading) return <CircularProgress size={22} />;

  if (posts.length === 0) {
    return (
      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Typography sx={{ fontWeight: 900 }}>No posts published yet</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Race Radar is ready. Publish the first post from the admin portal.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      {posts.map((post) => (
        <Card key={post.id} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {post.cover_image_url ? (
                <Box
                  component="img"
                  src={post.cover_image_url}
                  alt=""
                  sx={{ width: { xs: '100%', md: 220 }, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 1 }}
                />
              ) : null}
              <Stack spacing={1} sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  {post.title}
                </Typography>
                <Typography color="text.secondary">{post.excerpt}</Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  {post.tags.map((tag) => (
                    <Chip key={tag} size="small" label={tag} variant="outlined" />
                  ))}
                </Stack>
                <Button component={Link} href={`/race-radar/${post.slug}`} variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                  Read post
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
