import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';
import { buildReceiptNumber, computeInvoiceStatus } from '@/lib/fee-management';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabaseAdmin = createServiceRoleClient();

    const [companiesRes, invoicesRes, settingsRes, depositsRes] = await Promise.all([
      supabaseAdmin
        .from('applications')
        .select('id, business_name, email')
        .eq('status', 'approved')
        .order('business_name', { ascending: true }),
      supabaseAdmin
        .from('incubation_fee_invoices')
        .select('*, applications(business_name, email)')
        .in('status', ['pending', 'partially_paid', 'overdue'])
        .order('due_date', { ascending: true }),
      supabaseAdmin
        .from('incubation_fee_settings')
        .select('*'),
      supabaseAdmin
        .from('company_deposits')
        .select('*'),
    ]);

    if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 400 });
    if (invoicesRes.error) return NextResponse.json({ error: invoicesRes.error.message }, { status: 400 });
    if (settingsRes.error) return NextResponse.json({ error: settingsRes.error.message }, { status: 400 });
    if (depositsRes.error) return NextResponse.json({ error: depositsRes.error.message }, { status: 400 });

    return NextResponse.json({
      companies: companiesRes.data || [],
      invoices: invoicesRes.data || [],
      settings: settingsRes.data || [],
      deposits: depositsRes.data || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load payments data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const body = await request.json();
    const {
      companyId,
      collectionType,
      invoiceId,
      paymentDate,
      amountPaid,
      paymentMode,
      transactionReference,
      remarks,
    } = body;

    if (!companyId || !amountPaid || !paymentMode || !paymentDate) {
      return NextResponse.json({ error: 'Company, amount, payment mode, and date are required.' }, { status: 400 });
    }

    const amount = Number(amountPaid);
    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    let resolvedInvoiceId: string | null = null;
    let invoiceNumber: string | null = null;
    let billingMonth: string | null = null;

    if (collectionType === 'monthly_fee' && invoiceId) {
      // Fetch invoice and its company's grace_period_days separately
      // (avoid !inner join which returns null if fee_settings row is missing)
      const { data: invoice, error: invError } = await supabaseAdmin
        .from('incubation_fee_invoices')
        .select('*')
        .eq('id', invoiceId)
        .neq('status', 'void')
        .maybeSingle();

      if (invError || !invoice) {
        return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
      }

      // Fetch grace_period_days from fee settings separately
      const { data: feeSetting } = await supabaseAdmin
        .from('incubation_fee_settings')
        .select('grace_period_days')
        .eq('company_id', invoice.company_id)
        .maybeSingle();

      resolvedInvoiceId = invoice.id;
      invoiceNumber = invoice.invoice_number;
      billingMonth = invoice.billing_month;

      const nextPaid = Number(invoice.amount_paid || 0) + amount;
      const gracePeriodDays = Number(feeSetting?.grace_period_days || 0);
      const nextStatus = computeInvoiceStatus({
        amount: Number(invoice.amount || 0),
        amountPaid: nextPaid,
        dueDate: invoice.due_date,
        gracePeriodDays,
      });

      const { error: updateError } = await supabaseAdmin
        .from('incubation_fee_invoices')
        .update({ amount_paid: nextPaid, status: nextStatus })
        .eq('id', invoiceId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    }

    const receiptNumber = buildReceiptNumber();
    const { error: insertError } = await supabaseAdmin.from('fee_collections').insert({
      company_id: companyId,
      receipt_number: receiptNumber,
      collection_type: collectionType,
      invoice_id: resolvedInvoiceId,
      deposit_id: null,
      collection_date: paymentDate,
      amount_collected: amount,
      payment_mode: paymentMode,
      transaction_reference: transactionReference || null,
      collected_by: user.email || 'Admin',
      remarks: remarks || null,
      attachment_url: null,
      status: 'recorded',
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    // Fetch company name for receipt
    const { data: appData } = await supabaseAdmin
      .from('applications')
      .select('business_name, email')
      .eq('id', companyId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      receipt: {
        receiptNumber,
        receiptDate: paymentDate,
        companyName: appData?.business_name || appData?.email || 'Company',
        invoiceNumber,
        billingMonth,
        amountPaid: amount,
        paymentMode,
        transactionReference: transactionReference || null,
        receivedBy: user.email || 'Admin',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to record payment' },
      { status: 500 }
    );
  }
}
