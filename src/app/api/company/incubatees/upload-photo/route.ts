/**
 * POST /api/company/incubatees/upload-photo
 * Accepts multipart/form-data with a "photo" file field.
 * Uploads to Supabase storage bucket "incubatee-photos" using service role.
 * Returns the public/signed URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, getRequestUser } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = String(user.user_metadata?.role || '').toLowerCase();
    if (role !== 'company') return NextResponse.json({ error: 'Only company accounts can upload photos' }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get('photo') as File | null;

    if (!file) return NextResponse.json({ error: 'No photo file provided.' }, { status: 400 });

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG or WebP images are allowed.' }, { status: 400 });
    }

    // Validate file size (max 2MB for passport photo)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo must be less than 2MB.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `photos/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('incubatee-photos')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

    // Generate a signed URL (valid 10 years — effectively permanent for display)
    const { data: signedData, error: signError } = await supabase.storage
      .from('incubatee-photos')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);

    if (signError || !signedData) {
      return NextResponse.json({ error: 'Failed to generate photo URL' }, { status: 500 });
    }

    return NextResponse.json({ photoUrl: filePath, signedUrl: signedData.signedUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to upload photo' }, { status: 500 });
  }
}
