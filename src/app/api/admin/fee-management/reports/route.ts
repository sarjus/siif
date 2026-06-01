import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, getRequestUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
    if (role === 'company') {
      return NextResponse.json({ error: 'Company accounts cannot view admin reports.' }, { status: 403 });
    }

    const supabaseAdmin = createServiceRoleClient();
    const [
      { data: collectionsData, error: collectionsError },
      { data: invoiceData, error: invoicesError },
      { data: depositData, error: depositsError },
    ] = await Promise.all([
      supabaseAdmin
        .from('fee_collections')
        .select('*, applications(business_name)')
        .order('collection_date', { ascending: false }),
      supabaseAdmin
        .from('incubation_fee_invoices')
        .select('*, applications(business_name)')
        .neq('status', 'void')
        .order('billing_month', { ascending: false }),
      supabaseAdmin
        .from('company_deposits')
        .select('*, applications(business_name)')
        .order('created_at', { ascending: false }),
    ]);

    if (collectionsError) {
      return NextResponse.json({ error: collectionsError.message }, { status: 400 });
    }

    if (invoicesError) {
      return NextResponse.json({ error: invoicesError.message }, { status: 400 });
    }

    if (depositsError) {
      return NextResponse.json({ error: depositsError.message }, { status: 400 });
    }

    return NextResponse.json({
      collections: collectionsData || [],
      invoices: invoiceData || [],
      deposits: depositData || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load reports' },
      { status: 500 }
    );
  }
}
