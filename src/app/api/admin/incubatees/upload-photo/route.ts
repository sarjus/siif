import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';
import { signPhotoUrl } from '@/lib/photo-token';

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const formData = await request.formData();
    const file = formData.get('photo') as File | null;
    const incubateeId = formData.get('incubateeId') as string | null;

    if (!file) return NextResponse.json({ error: 'No photo provided.' }, { status: 400 });
    if (!incubateeId) return NextResponse.json({ error: 'incubateeId required.' }, { status: 400 });

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG or WebP images allowed.' }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo must be less than 2MB.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const filePath = `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('incubatee-photos')
      .upload(filePath, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

    // Update the incubatee record
    const { error: updateError } = await supabase
      .from('incubatees')
      .update({ photo_url: filePath })
      .eq('id', incubateeId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    // Return a signed proxy URL — Supabase signed URLs are never sent to the browser
    const proxyUrl = signPhotoUrl(filePath, '/api/admin/incubatees/photo');

    return NextResponse.json({ photoUrl: filePath, signedUrl: proxyUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
