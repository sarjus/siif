import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    const supabaseAdmin = createServiceRoleClient();
    let query = supabaseAdmin
      .from('fee_revision_history')
      .select('*, applications(business_name, email)')
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false });

    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ revisions: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load revisions' }, { status: 500 });
  }
}
