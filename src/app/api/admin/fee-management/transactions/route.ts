import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';
import { computeDepositStatus, computeInvoiceStatus } from '@/lib/fee-management';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabaseAdmin = createServiceRoleClient();

    const [{ data: transactions, error: txError }, { data: companies, error: compError }] = await Promise.all([
      supabaseAdmin
        .from('fee_collections')
        .select('*, applications(business_name, email), incubation_fee_invoices(invoice_number, billing_month, amount, due_date, company_id)')
        .order('collection_date', { ascending: false }),
      supabaseAdmin
        .from('applications')
        .select('id, business_name')
        .eq('status', 'approved')
        .order('business_name', { ascending: true }),
    ]);

    if (txError) return NextResponse.json({ error: txError.message }, { status: 400 });
    if (compError) return NextResponse.json({ error: compError.message }, { status: 400 });

    return NextResponse.json({ transactions: transactions || [], companies: companies || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load transactions' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { transactionId, updates } = await request.json();
    if (!transactionId) return NextResponse.json({ error: 'Transaction ID required.' }, { status: 400 });

    const supabaseAdmin = createServiceRoleClient();
    const { error } = await supabaseAdmin.from('fee_collections').update(updates).eq('id', transactionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { transactionId } = await request.json();
    if (!transactionId) return NextResponse.json({ error: 'Transaction ID required.' }, { status: 400 });

    const supabaseAdmin = createServiceRoleClient();

    // Fetch the transaction to know what to recalculate
    const { data: tx, error: fetchError } = await supabaseAdmin
      .from('fee_collections')
      .select('*')
      .eq('id', transactionId)
      .maybeSingle();

    if (fetchError || !tx) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });

    const { error: deleteError } = await supabaseAdmin.from('fee_collections').delete().eq('id', transactionId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

    // Recalculate invoice if linked
    if (tx.invoice_id) {
      const [{ data: invoice }, { data: setting }, { data: collections }] = await Promise.all([
        supabaseAdmin.from('incubation_fee_invoices').select('*').eq('id', tx.invoice_id).maybeSingle(),
        supabaseAdmin.from('incubation_fee_settings').select('grace_period_days').eq('company_id', tx.company_id).maybeSingle(),
        supabaseAdmin.from('fee_collections').select('amount_collected').eq('invoice_id', tx.invoice_id).eq('status', 'recorded'),
      ]);
      if (invoice) {
        const totalPaid = (collections || []).reduce((sum, item) => sum + Number(item.amount_collected || 0), 0);
        const status = computeInvoiceStatus({ amount: Number(invoice.amount || 0), amountPaid: totalPaid, dueDate: invoice.due_date, gracePeriodDays: Number(setting?.grace_period_days || 0) });
        await supabaseAdmin.from('incubation_fee_invoices').update({ amount_paid: totalPaid, status }).eq('id', tx.invoice_id);
      }
    }

    // Recalculate deposit if linked
    if (tx.deposit_id) {
      const [{ data: deposit }, { data: collections }] = await Promise.all([
        supabaseAdmin.from('company_deposits').select('*').eq('id', tx.deposit_id).maybeSingle(),
        supabaseAdmin.from('fee_collections').select('collection_type, amount_collected').eq('deposit_id', tx.deposit_id).eq('status', 'recorded'),
      ]);
      if (deposit) {
        const totalCollected = (collections || []).filter((c) => c.collection_type === 'refundable_deposit').reduce((sum, c) => sum + Number(c.amount_collected || 0), 0);
        const totalRefunded = (collections || []).filter((c) => c.collection_type === 'deposit_refund').reduce((sum, c) => sum + Number(c.amount_collected || 0), 0);
        const status = computeDepositStatus({ depositAmount: Number(deposit.deposit_amount || 0), amountCollected: totalCollected, amountRefunded: totalRefunded });
        await supabaseAdmin.from('company_deposits').update({ amount_collected: totalCollected, amount_refunded: totalRefunded, balance_amount: Math.max(Number(deposit.deposit_amount || 0) - totalCollected + totalRefunded, 0), status }).eq('id', tx.deposit_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete transaction' }, { status: 500 });
  }
}
