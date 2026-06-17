/**
 * GET  /api/admin/incubatees            — list all incubatees
 * POST /api/admin/incubatees            — approve or reject
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';
import { nextIncubateeId } from '@/lib/sequential-numbers';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending | approved | rejected | all

    const supabase = createServiceRoleClient();
    let query = supabase
      .from('incubatees')
      .select('*, applications(business_name, email)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ incubatees: data || [] });
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

    const supabase = createServiceRoleClient();

    const { data: existing } = await supabase
      .from('incubatees').select('id, status').eq('id', incubateeId).maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Incubatee not found.' }, { status: 404 });
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending entries can be approved or rejected.' }, { status: 400 });
    }

    if (action === 'reject') {
      const { error } = await supabase.from('incubatees').update({
        status: 'rejected',
        rejection_reason: rejectionReason || null,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      }).eq('id', incubateeId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, action: 'rejected' });
    }

    // Approve: generate sequential incubatee ID (26SIIF001)
    const newId = await nextIncubateeId(supabase);

    const { data, error } = await supabase.from('incubatees').update({
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
