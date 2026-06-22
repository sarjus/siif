/**
 * GET /api/admin/attendance/logs
 * Query params:
 *   page        — page number (default 1)
 *   pageSize    — records per page (default 50, max 200)
 *   from        — ISO date string (optional)
 *   to          — ISO date string (optional)
 *   pin         — device PIN filter (optional)
 *   deviceSn    — device serial filter (optional)
 *   punchType   — 0=In 1=Out (optional)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const pin = searchParams.get('pin');
    const deviceSn = searchParams.get('deviceSn');
    const punchType = searchParams.get('punchType');

    const supabase = createServiceRoleClient();

    let query = supabase
      .from('attendance_logs')
      .select(
        `id, device_sn, pin, punch_time, punch_type, verify_type, work_code,
         incubatee_id,
         incubatees(full_name, incubatee_id, designation,
           applications(business_name)),
         attendance_devices(name, location)`,
        { count: 'exact' }
      )
      .order('punch_time', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (from)      query = query.gte('punch_time', from);
    if (to)        query = query.lte('punch_time', to);
    if (pin)       query = query.eq('pin', pin);
    if (deviceSn)  query = query.eq('device_sn', deviceSn);
    if (punchType !== null && punchType !== '') query = query.eq('punch_type', parseInt(punchType, 10));

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      logs: data || [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
