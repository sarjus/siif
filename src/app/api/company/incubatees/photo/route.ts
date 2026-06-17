import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, getRequestUser } from '@/lib/server-auth';

// Only allow paths in the form: photos/<filename>
const SAFE_PATH_RE = /^photos\/[\w\-.]+$/;

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = String(user.user_metadata?.role || '').toLowerCase();
    if (role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

    // Reject paths outside expected storage layout
    if (!SAFE_PATH_RE.test(path)) {
      return NextResponse.json({ error: 'Invalid photo path' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Ownership check: the path must belong to an incubatee under this company.
    // Lookup the application for this user's email, then verify the incubatee.
    const email = (user.email || '').trim().toLowerCase();
    const { data: application } = await supabase
      .from('applications')
      .select('id')
      .ilike('email', email)
      .eq('status', 'approved')
      .maybeSingle();

    if (!application) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: incubatee } = await supabase
      .from('incubatees')
      .select('id')
      .eq('company_id', application.id)
      .eq('photo_url', path)
      .maybeSingle();

    if (!incubatee) {
      // Path doesn't belong to this company's incubatee
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase.storage
      .from('incubatee-photos')
      .download(path);

    if (error || !data) return NextResponse.json({ error: 'Failed to get photo' }, { status: 400 });

    const arrayBuffer = await data.arrayBuffer();
    const contentType = data.type || 'image/jpeg';

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
