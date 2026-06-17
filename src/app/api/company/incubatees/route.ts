/**
 * GET  /api/company/incubatees?companyId=...  — list own incubatees
 * POST /api/company/incubatees               — add new incubatee
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, getRequestUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const supabase = createServiceRoleClient();

    // Verify ownership
    const { data: app } = await supabase
      .from('applications').select('id').eq('id', companyId)
      .ilike('email', user.email || '').maybeSingle();
    if (!app) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await supabase
      .from('incubatees').select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ incubatees: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = String(user.user_metadata?.role || '').toLowerCase();
    if (role !== 'company') return NextResponse.json({ error: 'Only company accounts can add incubatees' }, { status: 403 });

    const body = await request.json() as {
      companyId?: string; fullName?: string; designation?: string;
      email?: string; mobile?: string; gender?: string; dateOfBirth?: string;
      address?: string; idType?: string; idNumber?: string; photoUrl?: string;
    };

    const { companyId, fullName, designation } = body;
    if (!companyId || !fullName?.trim() || !designation?.trim()) {
      return NextResponse.json({ error: 'Company, full name and designation are required.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Verify ownership
    const { data: app } = await supabase
      .from('applications').select('id').eq('id', companyId)
      .ilike('email', user.email || '').eq('status', 'approved').maybeSingle();
    if (!app) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await supabase
      .from('incubatees').insert({
        company_id: companyId,
        full_name: fullName.trim(),
        designation: designation.trim(),
        email: body.email?.trim() || null,
        mobile: body.mobile?.trim() || null,
        gender: body.gender || null,
        date_of_birth: body.dateOfBirth || null,
        address: body.address?.trim() || null,
        id_type: body.idType || null,
        id_number: body.idNumber?.trim() || null,
        photo_url: body.photoUrl || null,
        status: 'pending',
        submitted_by: user.email,
      }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ incubatee: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = String(user.user_metadata?.role || '').toLowerCase();
    if (role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json() as {
      id?: string; companyId?: string; fullName?: string; designation?: string;
      email?: string; mobile?: string; gender?: string; dateOfBirth?: string;
      address?: string; idType?: string; idNumber?: string; photoUrl?: string;
    };

    if (!body.id || !body.companyId) return NextResponse.json({ error: 'id and companyId required' }, { status: 400 });

    const supabase = createServiceRoleClient();

    // Verify ownership and pending status
    const { data: existing } = await supabase
      .from('incubatees').select('status, company_id')
      .eq('id', body.id).maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status !== 'pending') return NextResponse.json({ error: 'Only pending entries can be edited' }, { status: 400 });

    const { data, error } = await supabase
      .from('incubatees').update({
        full_name: body.fullName?.trim(),
        designation: body.designation?.trim(),
        email: body.email?.trim() || null,
        mobile: body.mobile?.trim() || null,
        gender: body.gender || null,
        date_of_birth: body.dateOfBirth || null,
        address: body.address?.trim() || null,
        id_type: body.idType || null,
        id_number: body.idNumber?.trim() || null,
        photo_url: body.photoUrl || null,
      }).eq('id', body.id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ incubatee: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
