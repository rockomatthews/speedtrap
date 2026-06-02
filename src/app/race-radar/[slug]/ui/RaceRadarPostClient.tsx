'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { type RaceRadarPost } from '@/lib/race-radar/types';

export function RaceRadarPostClient({ slug }: { slug: string }) {
  const [post, setPost] = useState<RaceRadarPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/race-radar/posts/${encodeURIComponent(slug)}`);
        const json = (await res.json().catch(() => null)) as { post?: RaceRadarPost; error?: string } | null;
        if (!res.ok) throw new Error(json?.error ?? 'Failed to load post.');
        if (!cancelled) setPost(json?.post ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load post.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (loading || !post) return <CircularProgress size={22} />;

  return (
    <Stack spacing={2} sx={{ maxWidth: 900 }}>
      {post.cover_image_url ? (
        <Box
          component="img"
          src={post.cover_image_url}
          alt=""
          sx={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 1 }}
        />
      ) : null}
      <Stack spacing={1}>
        <Typography variant="h3" sx={{ fontWeight: 950 }}>
          {post.title}
        </Typography>
        <Typography color="text.secondary">{post.excerpt}</Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap">
          {post.tags.map((tag) => (
            <Chip key={tag} size="small" label={tag} variant="outlined" />
          ))}
        </Stack>
      </Stack>
      <Box sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary', fontSize: 18, lineHeight: 1.7 }}>{post.body}</Box>
    </Stack>
  );
}
