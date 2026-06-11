import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

export async function POST(request: Request) {
  const { user } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('avatar');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a profile image to upload.' }, { status: 400 });
  }

  const ext = ALLOWED_TYPES.get(file.type);
  if (!ext) {
    return NextResponse.json({ error: 'Profile image must be a JPG, PNG, or WebP file.' }, { status: 400 });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'Profile image must be smaller than 5 MB.' }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const path = `${user.id}/avatar.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const upload = await supabaseAdmin.storage.from('profile-avatars').upload(path, bytes, {
    contentType: file.type,
    upsert: true
  });
  if (upload.error) {
    return NextResponse.json({ error: `Failed to upload profile image: ${upload.error.message}` }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from('profile-avatars').getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error } = await supabaseAdmin.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
  if (error) {
    return NextResponse.json({ error: `Profile image uploaded, but profile update failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl });
}
