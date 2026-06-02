import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const POST_SELECT =
  'id,slug,title,excerpt,cover_image_url,body,body_json,tags,published,published_at,created_by,created_at,updated_at';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('race_radar_posts')
    .select(POST_SELECT)
    .eq('published', true)
    .order('published_at', { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json(
      { error: `Failed to load Race Radar posts: ${error.message}. Run migrations 0010 through 0012 in Supabase.` },
      { status: 500 }
    );
  }

  return NextResponse.json({ posts: data ?? [] });
}
