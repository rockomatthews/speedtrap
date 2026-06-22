'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { type RaceRadarPost } from '@/lib/race-radar/types';

function publishedDate(post: RaceRadarPost) {
  const raw = post.published_at ?? post.created_at;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function PostImage({ post, featured = false }: { post: RaceRadarPost; featured?: boolean }) {
  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: featured ? { xs: 260, md: 470 } : 220,
        overflow: 'hidden',
        bgcolor: '#121212'
      }}
    >
      <Box
        component="img"
        src={post.cover_image_url ?? '/home/speedtrap-active-sims.jpg'}
        alt={post.cover_image_url ? post.title : ''}
        sx={{
          display: 'block',
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          objectFit: 'cover',
          transition: 'transform 320ms ease'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, transparent 48%, rgba(0,0,0,0.78))',
          pointerEvents: 'none'
        }}
      />
    </Box>
  );
}

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
            Race Radar is ready. Publish the first story in Contentful.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const [featured, ...remaining] = posts;

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Box
        component={Link}
        href={`/race-radar/${featured.slug}`}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.35fr) minmax(340px, 0.65fr)' },
          color: 'inherit',
          textDecoration: 'none',
          border: '1px solid rgba(255,210,0,0.42)',
          bgcolor: '#0d0d0d',
          overflow: 'hidden',
          '&:hover img': { transform: 'scale(1.025)' }
        }}
      >
        <PostImage post={featured} featured />
        <Stack spacing={2} justifyContent="center" sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
          <Typography color="primary.main" sx={{ fontSize: 14, fontWeight: 950, textTransform: 'uppercase' }}>
            Latest from Race Radar
          </Typography>
          <Typography variant="h2" sx={{ fontSize: { xs: 36, md: 52 }, fontWeight: 950, lineHeight: 0.98 }}>
            {featured.title}
          </Typography>
          {featured.excerpt ? (
            <Typography color="text.secondary" sx={{ fontSize: 18, lineHeight: 1.55 }}>
              {featured.excerpt}
            </Typography>
          ) : null}
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Typography color="text.secondary" sx={{ fontSize: 14 }}>
              {publishedDate(featured)}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.75} color="primary.main">
              <Typography sx={{ fontWeight: 900 }}>Read story</Typography>
              <ArrowForwardIcon fontSize="small" />
            </Stack>
          </Stack>
        </Stack>
      </Box>

      {remaining.length ? (
        <Stack spacing={2.5}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between">
            <Typography variant="h4" sx={{ fontWeight: 950 }}>
              More stories
            </Typography>
            <Typography color="text.secondary">{remaining.length} posts</Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 3
            }}
          >
            {remaining.map((post) => (
              <Card
                key={post.id}
                component={Link}
                href={`/race-radar/${post.slug}`}
                variant="outlined"
                sx={{
                  display: 'grid',
                  gridTemplateRows: '220px 1fr',
                  color: 'inherit',
                  textDecoration: 'none',
                  borderColor: 'rgba(255,255,255,0.14)',
                  bgcolor: '#0d0d0d',
                  overflow: 'hidden',
                  '&:hover': { borderColor: 'primary.main' },
                  '&:hover img': { transform: 'scale(1.035)' }
                }}
              >
                <PostImage post={post} />
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={1.5} height="100%">
                    <Typography color="primary.main" sx={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase' }}>
                      {publishedDate(post)}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 950, lineHeight: 1.05 }}>
                      {post.title}
                    </Typography>
                    {post.excerpt ? (
                      <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {post.excerpt}
                      </Typography>
                    ) : null}
                    {post.tags.length ? (
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 'auto', pt: 1 }}>
                        {post.tags.slice(0, 3).map((tag) => (
                          <Chip key={tag} size="small" label={tag} variant="outlined" />
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Stack>
      ) : null}
    </Stack>
  );
}
