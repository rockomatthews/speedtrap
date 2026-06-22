'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { type RaceRadarPost } from '@/lib/race-radar/types';

function publishedDate(post: RaceRadarPost) {
  const raw = post.published_at ?? post.created_at;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function bodyToHtml(value: string) {
  if (/<[a-z][\s\S]*>/i.test(value)) return value;
  return escapeHtml(value).replace(/\n/g, '<br />');
}

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
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Stack spacing={2} sx={{ maxWidth: 980 }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
          <Typography color="primary.main" sx={{ fontSize: 14, fontWeight: 950, textTransform: 'uppercase' }}>
            Race Radar
          </Typography>
          <Typography color="text.secondary" aria-hidden="true">
            /
          </Typography>
          <Typography color="text.secondary">{publishedDate(post)}</Typography>
        </Stack>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: 44, sm: 62, md: 78 },
            fontWeight: 950,
            lineHeight: 0.94,
            maxWidth: 1050
          }}
        >
          {post.title}
        </Typography>
        {post.excerpt ? (
          <Typography color="text.secondary" sx={{ maxWidth: 820, fontSize: { xs: 19, md: 24 }, lineHeight: 1.45 }}>
            {post.excerpt}
          </Typography>
        ) : null}
        {post.tags.length ? (
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {post.tags.map((tag) => (
              <Chip key={tag} size="small" label={tag} variant="outlined" />
            ))}
          </Stack>
        ) : null}
      </Stack>

      {post.cover_image_url ? (
        <Box
          component="img"
          src={post.cover_image_url}
          alt={post.title}
          sx={{ width: '100%', maxHeight: 620, aspectRatio: { xs: '4 / 3', md: '16 / 8' }, objectFit: 'cover' }}
        />
      ) : null}
      <Box
        className="race-radar-post-body"
        sx={{
          width: '100%',
          maxWidth: 820,
          mx: 'auto',
          color: 'text.secondary',
          fontSize: { xs: 17, md: 19 },
          lineHeight: 1.8,
          '& h1, & h2, & h3, & h4': {
            color: 'text.primary',
            fontWeight: 950,
            lineHeight: 1.04,
            mt: 4,
            mb: 1.5
          },
          '& h1': { fontSize: { xs: 36, md: 50 } },
          '& h2': { fontSize: { xs: 30, md: 40 } },
          '& h3': { fontSize: { xs: 24, md: 31 } },
          '& h4': { fontSize: { xs: 21, md: 25 } },
          '& p': { mt: 0, mb: 2.5 },
          '& ul, & ol': { pl: 3, mb: 2 },
          '& li': { mb: 0.75 },
          '& a': { color: 'primary.main', fontWeight: 800 },
          '& img': {
            display: 'block',
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            my: 3
          },
          '& blockquote': {
            borderLeft: '4px solid',
            borderColor: 'primary.main',
            m: 0,
            my: 3,
            pl: 2.5,
            color: 'text.primary',
            fontSize: { xs: 21, md: 25 },
            fontWeight: 800
          },
          '& hr': {
            border: 0,
            borderTop: '1px solid rgba(255,255,255,0.16)',
            my: 4
          },
          '& table': {
            width: '100%',
            borderCollapse: 'collapse',
            my: 3
          },
          '& th, & td': {
            borderBottom: '1px solid rgba(255,255,255,0.14)',
            p: 1.25,
            textAlign: 'left'
          }
        }}
        dangerouslySetInnerHTML={{ __html: bodyToHtml(post.body) }}
      />
    </Stack>
  );
}
