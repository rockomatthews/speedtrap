import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/require-admin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const POST_SELECT =
  'id,slug,title,excerpt,cover_image_url,body,body_json,tags,published,published_at,created_by,created_at,updated_at';

const postSchema = z.object({
  title: z.string().trim().min(3),
  slug: z.string().trim().optional(),
  excerpt: z.string().trim().optional().default(''),
  coverImageUrl: z.string().trim().url().optional().or(z.literal('')).default(''),
  body: z.string().trim().optional().default(''),
  bodyJson: z.unknown().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  published: z.boolean().optional().default(false)
});

function toSlug(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'race-radar'
  );
}

function cleanTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 8);
}

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.from('race_radar_posts').select(POST_SELECT).order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: `Failed to load posts: ${error.message}` }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const raw = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid post.' }, { status: 400 });
  }

  const input = parsed.data;
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('race_radar_posts')
    .insert({
      title: input.title,
      slug: toSlug(input.slug || input.title),
      excerpt: input.excerpt,
      cover_image_url: input.coverImageUrl || null,
      body: input.body,
      body_json: input.bodyJson ?? null,
      tags: cleanTags(input.tags),
      published: input.published,
      published_at: input.published ? new Date().toISOString() : null,
      created_by: adminCheck.user.id
    })
    .select(POST_SELECT)
    .single();

  if (error) return NextResponse.json({ error: `Failed to create post: ${error.message}` }, { status: 500 });
  return NextResponse.json({ post: data }, { status: 201 });
}
