import { NextRequest, NextResponse } from 'next/server';
import { getPhotoContentType, readPhoto } from '@/lib/local-storage';
import { verifyPhotoToken } from '@/lib/photo-token';

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const photoPath = searchParams.get('path');
    if (!photoPath) return NextResponse.json({ error: 'path required' }, { status: 400 });
    if (!verifyPhotoToken(photoPath, searchParams.get('exp'), searchParams.get('token'))) {
      return NextResponse.json({ error: 'Invalid or expired photo token' }, { status: 401 });
    }

    let bytes: Buffer;
    try {
      bytes = await readPhoto(photoPath);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
      }
      throw error;
    }
    return new NextResponse(Uint8Array.from(bytes).buffer, {
      status: 200,
      headers: {
        'Content-Type': getPhotoContentType(photoPath),
        'Cache-Control': 'private, max-age=3600, no-store',
      },
    });
  } catch (error) {
    console.error('Failed to read admin incubatee photo:', error);
    return NextResponse.json({ error: 'Failed to read photo.' }, { status: 500 });
  }
}
