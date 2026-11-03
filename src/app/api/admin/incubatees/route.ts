/**
 * GET   /api/admin/incubatees            — list all incubatees
 * POST  /api/admin/incubatees            — approve or reject
 * PATCH /api/admin/incubatees            — edit incubatee_id of an approved entry
 */
import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseClient, requireAdmin } from '@/lib/server-auth';
import { nextIncubateeId } from '@/lib/sequential-numbers';
import { signPhotoUrl } from '@/lib/photo-token';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const database = createDatabaseClient();
    let query = database
      .from('incubatees')
      .select('*, applications(business_name, email)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const incubatees = data || [];

    // Attach a server-signed proxy URL for each photo.
    // Private storage URLs are NOT sent to the browser — only HMAC-protected
    // proxy URLs that our own route validates before streaming the image.
    const result = incubatees.map((i) => ({
      ...i,
      signed_photo_url: i.photo_url
        ? signPhotoUrl(i.photo_url, '/api/admin/incubatees/photo')
        : null,
    }));

    return NextResponse.json({ incubatees: result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const body = await request.json() as {
      incubateeId?: string;
      action?: 'approve' | 'reject';
      rejectionReason?: string;
    };

    const { incubateeId, action, rejectionReason } = body;
    if (!incubateeId || !action) {
      return NextResponse.json({ error: 'incubateeId and action are required.' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject.' }, { status: 400 });
    }

    const database = createDatabaseClient();

    const { data: existing } = await database
      .from('incubatees').select('id, status').eq('id', incubateeId).maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Incubatee not found.' }, { status: 404 });
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending entries can be approved or rejected.' }, { status: 400 });
    }

    if (action === 'reject') {
      const { error } = await database.from('incubatees').update({
        status: 'rejected',
        rejection_reason: rejectionReason || null,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      }).eq('id', incubateeId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, action: 'rejected' });
    }

    // Approve: generate sequential incubatee ID (26SIIF001)
    const newId = await nextIncubateeId(database);

    const { data, error } = await database.from('incubatees').update({
      status: 'approved',
      incubatee_id: newId,
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
    }).eq('id', incubateeId).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, action: 'approved', incubatee: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const body = await request.json() as {
      incubateeId?: string;   // row UUID
      newIncubateeId?: string; // the new display ID, e.g. 26SIIF005
    };

    const { incubateeId, newIncubateeId } = body;
    if (!incubateeId || !newIncubateeId?.trim()) {
      return NextResponse.json(
        { error: 'incubateeId and newIncubateeId are required.' },
        { status: 400 }
      );
    }

    // Validate format: 2-digit year + SIIF + 3-digit seq (e.g. 26SIIF001)
    if (!/^\d{2}SIIF\d{3}$/.test(newIncubateeId.trim())) {
      return NextResponse.json(
        { error: 'Invalid format. Expected YYSIIFnnn (e.g. 26SIIF001).' },
        { status: 400 }
      );
    }

    const database = createDatabaseClient();

    // Only approved entries can have their ID edited
    const { data: existing } = await database
      .from('incubatees')
      .select('id, status, incubatee_id')
      .eq('id', incubateeId)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Incubatee not found.' }, { status: 404 });
    if (existing.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved entries can have their ID edited.' },
        { status: 400 }
      );
    }

    // Check uniqueness — make sure the new ID isn't already in use by another row
    const { data: conflict } = await database
      .from('incubatees')
      .select('id')
      .eq('incubatee_id', newIncubateeId.trim())
      .neq('id', incubateeId)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json(
        { error: `ID "${newIncubateeId.trim()}" is already assigned to another incubatee.` },
        { status: 409 }
      );
    }

    const { data, error } = await database
      .from('incubatees')
      .update({ incubatee_id: newIncubateeId.trim() })
      .eq('id', incubateeId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, incubatee: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
