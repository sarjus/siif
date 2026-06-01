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
      return NextResponse.json({ error: 'Company accounts cannot list admin invoices.' }, { status: 403 });
    }

    const supabaseAdmin = createServiceRoleClient();
    const { data, error } = await supabaseAdmin
      .from('incubation_fee_invoices')
      .select('*, applications(business_name, email)')
      .neq('status', 'void')
      .order('billing_month', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ invoices: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load invoices' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
    if (role === 'company') {
      return NextResponse.json({ error: 'Company accounts cannot delete admin invoices.' }, { status: 403 });
    }

    const { invoiceId } = (await request.json()) as { invoiceId?: string };
    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required.' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    // First verify the invoice exists and is not already voided
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('incubation_fee_invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    if (existing.status === 'void') {
      return NextResponse.json({ success: true }); // already voided
    }

    // Soft-delete: mark as void so sync won't recreate it
    const { error } = await supabaseAdmin
      .from('incubation_fee_invoices')
      .update({ status: 'void' })
      .eq('id', invoiceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}
