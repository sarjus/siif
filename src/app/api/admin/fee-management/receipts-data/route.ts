import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabaseAdmin = createServiceRoleClient();

    const { data: collections, error } = await supabaseAdmin
      .from('fee_collections')
      .select('*, applications(business_name, email), incubation_fee_invoices(invoice_number, billing_month)')
      .neq('status', 'cancelled')
      .order('collection_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ collections: collections || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load receipts' },
      { status: 500 }
    );
  }
}
