/**
 * GET  /api/conference/bookings  — All approved bookings (+ own pending/rejected for company)
 * POST /api/conference/bookings  — Company requests a new slot
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, getRequestUser, isEffectiveAdminUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceRoleClient();
    const isAdmin = await isEffectiveAdminUser(user);

    let query = supabase
      .from('conference_bookings')
      .select('*, applications(business_name, email)')
      .order('start_time', { ascending: true });

    if (!isAdmin) {
      // Companies see all approved + their own bookings of any status
      const { data: app } = await supabase
        .from('applications')
        .select('id')
        .ilike('email', user.email || '')
        .eq('status', 'approved')
        .maybeSingle();

      if (!app) return NextResponse.json({ bookings: [] });

      // Fetch approved from everyone + all statuses for own company
      const [approvedRes, ownRes] = await Promise.all([
        supabase.from('conference_bookings')
          .select('*, applications(business_name, email)')
          .eq('status', 'approved')
          .order('start_time', { ascending: true }),
        supabase.from('conference_bookings')
          .select('*, applications(business_name, email)')
          .eq('company_id', app.id)
          .neq('status', 'approved')  // avoid duplicates
          .order('start_time', { ascending: true }),
      ]);

      const seen = new Set<string>();
      const combined = [...(approvedRes.data || []), ...(ownRes.data || [])].filter((b) => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      });

      return NextResponse.json({ bookings: combined });
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ bookings: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load bookings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = String(user.user_metadata?.role || '').toLowerCase();
    if (role !== 'company') {
      return NextResponse.json({ error: 'Only company accounts can request bookings.' }, { status: 403 });
    }

    const body = await request.json() as {
      companyId?: string;
      title?: string;
      startTime?: string;
      endTime?: string;
    };

    const { companyId, title, startTime, endTime } = body;

    if (!companyId || !title?.trim() || !startTime || !endTime) {
      return NextResponse.json({ error: 'Company, title, start time, and end time are required.' }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date/time format.' }, { status: 400 });
    }
    if (end <= start) {
      return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 });
    }
    if (start < new Date()) {
      return NextResponse.json({ error: 'Cannot book a slot in the past.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Verify company ownership
    const { data: app } = await supabase
      .from('applications')
      .select('id')
      .eq('id', companyId)
      .ilike('email', user.email || '')
      .eq('status', 'approved')
      .maybeSingle();

    if (!app) return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });

    // Conflict check — approved bookings that overlap this slot
    const { data: conflicts } = await supabase
      .from('conference_bookings')
      .select('id, title, start_time, end_time')
      .eq('status', 'approved')
      .lt('start_time', endTime)
      .gt('end_time', startTime);

    if (conflicts && conflicts.length > 0) {
      const c = conflicts[0];
      const s = new Date(c.start_time).toLocaleString('en-IN', { hour12: false });
      const e = new Date(c.end_time).toLocaleString('en-IN', { hour12: false });
      return NextResponse.json({
        error: `Time slot conflicts with an existing booking: "${c.title}" (${s} – ${e}).`
      }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('conference_bookings')
      .insert({
        company_id: companyId,
        title: title.trim(),
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        requested_by: user.email,
      })
      .select('*, applications(business_name, email)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ booking: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create booking' }, { status: 500 });
  }
}
