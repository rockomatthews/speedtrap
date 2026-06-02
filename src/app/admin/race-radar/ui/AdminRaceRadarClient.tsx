'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { type RaceRadarPost } from '@/lib/race-radar/types';

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'race-radar'
  );
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function AdminRaceRadarClient() {
  const [posts, setPosts] = useState<RaceRadarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [published, setPublished] = useState(false);

  const editingPost = useMemo(() => posts.find((post) => post.id === editingId) ?? null, [editingId, posts]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/race-radar/posts');
      const json = (await res.json().catch(() => null)) as { posts?: RaceRadarPost[]; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to load posts.');
      setPosts(json?.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load posts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setExcerpt('');
    setCoverImageUrl('');
    setBody('');
    setTags('');
    setPublished(false);
  }

  function edit(post: RaceRadarPost) {
    setEditingId(post.id);
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt);
    setCoverImageUrl(post.cover_image_url ?? '');
    setBody(post.body);
    setTags(post.tags.join(', '));
    setPublished(post.published);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        title,
        slug: slug || slugify(title),
        excerpt,
        coverImageUrl,
        body,
        tags: splitTags(tags),
        published
      };
      const url = editingId ? `/api/admin/race-radar/posts/${editingId}` : '/api/admin/race-radar/posts';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = (await res.json().catch(() => null)) as { post?: RaceRadarPost; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to save post.');
      setMessage(editingId ? 'Post updated.' : 'Post created.');
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save post.');
    } finally {
      setSaving(false);
    }
  }

  async function deletePost(post: RaceRadarPost) {
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/race-radar/posts/${post.id}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(json?.error ?? 'Failed to delete post.');
      return;
    }
    setMessage('Post deleted.');
    if (editingId === post.id) resetForm();
    await load();
  }

  if (loading) return <CircularProgress size={22} />;

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={1.25}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              {editingPost ? `Edit ${editingPost.title}` : 'Create Race Radar post'}
            </Typography>
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField
              label="Slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder={title ? slugify(title) : 'challenge-recap'}
            />
            <TextField label="Excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} multiline minRows={2} />
            <TextField label="Cover image URL" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} />
            <TextField label="Body" value={body} onChange={(e) => setBody(e.target.value)} multiline minRows={8} />
            <TextField label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="hotlap, setup, recap" />
            <FormControlLabel
              control={<Checkbox checked={published} onChange={(_, checked) => setPublished(checked)} />}
              label="Published"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="contained" disabled={saving || title.trim().length < 3} onClick={save}>
                {saving ? 'Saving...' : editingPost ? 'Update post' : 'Create post'}
              </Button>
              {editingPost ? (
                <Button variant="outlined" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={1.25}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Posts
            </Typography>
            {posts.length === 0 ? (
              <Typography color="text.secondary">No posts yet.</Typography>
            ) : (
              posts.map((post) => (
                <Stack key={post.id} direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                  <Box>
                    <Typography sx={{ fontWeight: 900 }}>{post.title}</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                      /race-radar/{post.slug} · {post.published ? 'published' : 'draft'}
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    {post.published ? (
                      <Button component={Link} href={`/race-radar/${post.slug}`} variant="outlined">
                        View
                      </Button>
                    ) : null}
                    <Button variant="outlined" onClick={() => edit(post)}>
                      Edit
                    </Button>
                    <Button color="error" variant="outlined" onClick={() => void deletePost(post)}>
                      Delete
                    </Button>
                  </Stack>
                </Stack>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
