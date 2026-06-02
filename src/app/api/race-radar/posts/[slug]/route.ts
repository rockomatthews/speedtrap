import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const POST_SELECT =
  'id,slug,title,excerpt,cover_image_url,body,tags,published,published_at,created_by,created_at,updated_at';

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('race_radar_posts')
    .select(POST_SELECT)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: `Failed to load post: ${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  return NextResponse.json({ post: data });
}
