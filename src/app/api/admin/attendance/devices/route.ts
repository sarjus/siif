/**
 * GET   /api/admin/attendance/devices         — list all devices
 * POST  /api/admin/attendance/devices         — register a new device
 * PATCH /api/admin/attendance/devices         — update name/location/enabled
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('attendance_devices')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ devices: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const body = await request.json() as {
      serialNo?: string;
      name?: string;
      location?: string;
    };

    if (!body.serialNo?.trim() || !body.name?.trim()) {
      return NextResponse.json({ error: 'serialNo and name are required.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('attendance_devices')
      .insert({
        serial_no: body.serialNo.trim(),
        name: body.name.trim(),
        location: body.location?.trim() || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ device: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const body = await request.json() as {
      id?: string;
      name?: string;
      location?: string;
      enabled?: boolean;
    };

    if (!body.id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined)     updates.name = body.name.trim();
    if (body.location !== undefined) updates.location = body.location?.trim() || null;
    if (body.enabled !== undefined)  updates.enabled = body.enabled;

    const { data, error } = await supabase
      .from('attendance_devices')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ device: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
