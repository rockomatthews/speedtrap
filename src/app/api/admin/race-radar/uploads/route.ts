import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function extensionFor(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  return 'jpg';
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Upload an image file.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Race Radar uploads must be images.' }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image must be 8 MB or smaller.' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${adminCheck.user.id}/${Date.now()}-${randomUUID()}.${extensionFor(file)}`;
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.storage.from('race-radar').upload(path, bytes, {
    contentType: file.type,
    upsert: false
  });

  if (error) return NextResponse.json({ error: `Failed to upload image: ${error.message}` }, { status: 500 });

  const { data } = supabaseAdmin.storage.from('race-radar').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
