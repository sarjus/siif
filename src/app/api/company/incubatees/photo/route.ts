import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, getRequestUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.storage
      .from('incubatee-photos')
      .createSignedUrl(path, 3600); // 1 hour

    if (error || !data) return NextResponse.json({ error: 'Failed to get photo' }, { status: 400 });

    // Redirect to the signed URL
    return NextResponse.redirect(data.signedUrl);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
