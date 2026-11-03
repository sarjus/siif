import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseClient, getRequestUser } from '@/lib/server-auth';
import { getPhotoContentType, readPhoto } from '@/lib/local-storage';

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.user_metadata.role !== 'company') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const photoPath = new URL(request.url).searchParams.get('path');
    if (!photoPath) return NextResponse.json({ error: 'path required' }, { status: 400 });

    const database = createDatabaseClient();
    const { data: application, error: applicationError } = await database
      .from('applications')
      .select('id')
      .ilike('email', user.email)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (applicationError) throw applicationError;
    if (!application) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: incubatee, error: incubateeError } = await database
      .from('incubatees')
      .select('id')
      .eq('company_id', application.id)
      .eq('photo_url', photoPath)
      .maybeSingle();
    if (incubateeError) throw incubateeError;
    if (!incubatee) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Failed to read company incubatee photo:', error);
    return NextResponse.json({ error: 'Failed to read photo.' }, { status: 500 });
  }
}
