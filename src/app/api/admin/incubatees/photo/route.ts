import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/server-auth';
import { verifyPhotoToken } from '@/lib/photo-token';

// Only allow paths in the form: photos/<filename>
const SAFE_PATH_RE = /^photos\/[\w\-.]+$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path  = searchParams.get('path');
    const exp   = searchParams.get('exp');
    const token = searchParams.get('token');

    if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

    // Reject paths outside expected storage layout
    if (!SAFE_PATH_RE.test(path)) {
      return NextResponse.json({ error: 'Invalid photo path' }, { status: 400 });
    }

    // Verify the HMAC token — this replaces the Authorization header check.
    // The token is short-lived (1 hr) and tied to the exact path + expiry,
    // so a leaked URL is useless after it expires and cannot be reused for
    // a different path.
    if (!verifyPhotoToken(path, exp, token)) {
      return NextResponse.json({ error: 'Invalid or expired photo token' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.storage
      .from('incubatee-photos')
      .download(path);

    if (error || !data) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

    const arrayBuffer = await data.arrayBuffer();
    const contentType = data.type || 'image/jpeg';

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // private: browser caches it for the session but CDNs/proxies must not
        'Cache-Control': 'private, max-age=3600, no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
