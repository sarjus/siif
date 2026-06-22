/**
 * GET    /api/admin/attendance/mapping            — list all PIN → incubatee mappings
 * POST   /api/admin/attendance/mapping            — create/update a mapping
 * DELETE /api/admin/attendance/mapping?id=<uuid>  — remove a mapping
 *
 * When a mapping is created or updated we also back-fill existing logs
 * for the same (device_sn, pin) so historical records get linked too.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('attendance_user_mapping')
      .select(`
        id, device_sn, pin, created_at,
        incubatees(id, full_name, incubatee_id, designation,
          applications(business_name))
      `)
      .order('device_sn', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ mappings: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const body = await request.json() as {
      deviceSn?: string;
      pin?: string;
      incubateeId?: string; // uuid of incubatees row
    };

    if (!body.deviceSn?.trim() || !body.pin?.trim() || !body.incubateeId) {
      return NextResponse.json(
        { error: 'deviceSn, pin, and incubateeId are required.' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Upsert mapping
    const { data, error } = await supabase
      .from('attendance_user_mapping')
      .upsert(
        {
          device_sn: body.deviceSn.trim(),
          pin: body.pin.trim(),
          incubatee_id: body.incubateeId,
        },
        { onConflict: 'device_sn,pin' }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Back-fill existing logs for this device+pin
    await supabase
      .from('attendance_logs')
      .update({ incubatee_id: body.incubateeId })
      .eq('device_sn', body.deviceSn.trim())
      .eq('pin', body.pin.trim());

    return NextResponse.json({ mapping: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from('attendance_user_mapping')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
