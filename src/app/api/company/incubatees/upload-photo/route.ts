import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/server-auth';
import { savePhoto, validatePhoto } from '@/lib/local-storage';

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.user_metadata.role !== 'company') {
      return NextResponse.json({ error: 'Only company accounts can upload photos' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('photo');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No photo file provided.' }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo must be less than 2MB.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const extension = validatePhoto(file.type === 'image/jpg' ? 'image/jpeg' : file.type, bytes);
    if (!extension) {
      return NextResponse.json({ error: 'Only valid JPEG, PNG or WebP images are allowed.' }, { status: 400 });
    }
    const photoUrl = await savePhoto(bytes, extension);

    return NextResponse.json({
      photoUrl,
      signedUrl: `/api/company/incubatees/photo?path=${encodeURIComponent(photoUrl)}`,
    });
  } catch (error) {
    console.error('Failed to upload company incubatee photo:', error);
    return NextResponse.json({ error: 'Failed to upload photo.' }, { status: 500 });
  }
}
