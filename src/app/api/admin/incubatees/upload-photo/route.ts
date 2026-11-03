import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseClient, requireAdmin } from '@/lib/server-auth';
import { removePhoto, savePhoto, validatePhoto } from '@/lib/local-storage';
import { signPhotoUrl } from '@/lib/photo-token';

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const formData = await request.formData();
    const file = formData.get('photo');
    const incubateeId = formData.get('incubateeId');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No photo provided.' }, { status: 400 });
    if (typeof incubateeId !== 'string' || !incubateeId) {
      return NextResponse.json({ error: 'incubateeId required.' }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo must be less than 2MB.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const extension = validatePhoto(file.type === 'image/jpg' ? 'image/jpeg' : file.type, bytes);
    if (!extension) {
      return NextResponse.json({ error: 'Only valid JPEG, PNG or WebP images are allowed.' }, { status: 400 });
    }
    const photoPath = await savePhoto(bytes, extension);

    const database = createDatabaseClient();
    const { data: updatedIncubatee, error: updateError } = await database
      .from('incubatees')
      .update({ photo_url: photoPath })
      .eq('id', incubateeId)
      .select('id')
      .maybeSingle();

    if (updateError) {
      await removePhoto(photoPath);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
    if (!updatedIncubatee) {
      await removePhoto(photoPath);
      return NextResponse.json({ error: 'Incubatee not found.' }, { status: 404 });
    }
    const signedUrl = signPhotoUrl(photoPath, '/api/admin/incubatees/photo');
    return NextResponse.json({ photoUrl: photoPath, signedUrl });
  } catch (error) {
    console.error('Failed to upload admin incubatee photo:', error);
    return NextResponse.json({ error: 'Failed to upload photo.' }, { status: 500 });
  }
}
