import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';
import { computeInvoiceStatus } from '@/lib/fee-management';
import { nextReceiptNumber } from '@/lib/sequential-numbers';

// Admin: list all pending payment submissions
export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabaseAdmin = createServiceRoleClient();

    const { data, error } = await supabaseAdmin
      .from('company_payment_submissions')
      .select(`
        *,
        applications(business_name, email),
        incubation_fee_invoices(invoice_number, billing_month, amount, amount_paid, due_date, status)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ submissions: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load submissions' },
      { status: 500 }
    );
  }
}

// Admin: verify a submission and auto-generate receipt
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const body = await request.json();
    const { submissionId, action } = body; // action: 'approve' | 'reject'

    if (!submissionId || !action) {
      return NextResponse.json({ error: 'Submission ID and action are required.' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject.' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    // Fetch the submission
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('company_payment_submissions')
      .select('*')
      .eq('id', submissionId)
      .maybeSingle();

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
    }

    if (submission.status !== 'pending') {
      return NextResponse.json({ error: 'This submission has already been processed.' }, { status: 409 });
    }

    if (action === 'reject') {
      const { error: updateError } = await supabaseAdmin
        .from('company_payment_submissions')
        .update({ status: 'rejected', reviewed_by: user.email, reviewed_at: new Date().toISOString() })
        .eq('id', submissionId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, action: 'rejected' });
    }

    // Approve: create fee_collection record and update invoice if applicable
    const receiptNumber = await nextReceiptNumber(supabaseAdmin);
    const amount = Number(submission.amount_paid || 0);

    let invoiceNumber: string | null = null;
    let billingMonth: string | null = null;

    if (submission.invoice_id) {
      // Fetch invoice and update it
      const { data: invoice, error: invFetchError } = await supabaseAdmin
        .from('incubation_fee_invoices')
        .select('*, incubation_fee_settings!inner(grace_period_days)')
        .eq('id', submission.invoice_id)
        .maybeSingle();

      if (!invFetchError && invoice) {
        invoiceNumber = invoice.invoice_number;
        billingMonth = invoice.billing_month;
        const nextPaid = Number(invoice.amount_paid || 0) + amount;
        const gracePeriodDays = Number(invoice.incubation_fee_settings?.grace_period_days || 0);
        const nextStatus = computeInvoiceStatus({
          amount: Number(invoice.amount || 0),
          amountPaid: nextPaid,
          dueDate: invoice.due_date,
          gracePeriodDays,
        });

        await supabaseAdmin
          .from('incubation_fee_invoices')
          .update({ amount_paid: nextPaid, status: nextStatus })
          .eq('id', submission.invoice_id);
      }
    }

    // Insert fee collection
    const { error: collectionError } = await supabaseAdmin
      .from('fee_collections')
      .insert({
        company_id: submission.company_id,
        receipt_number: receiptNumber,
        collection_type: submission.invoice_id ? 'monthly_fee' : 'other_fees',
        invoice_id: submission.invoice_id || null,
        deposit_id: null,
        collection_date: submission.payment_date,
        amount_collected: amount,
        payment_mode: submission.payment_mode,
        transaction_reference: submission.transaction_reference || null,
        collected_by: user.email || 'Admin',
        remarks: submission.remarks || null,
        attachment_url: null,
        status: 'recorded',
      });

    if (collectionError) {
      return NextResponse.json({ error: collectionError.message }, { status: 400 });
    }

    // Mark submission as approved
    await supabaseAdmin
      .from('company_payment_submissions')
      .update({
        status: 'approved',
        receipt_number: receiptNumber,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    // Fetch company name for receipt
    const { data: appData } = await supabaseAdmin
      .from('applications')
      .select('business_name, email')
      .eq('id', submission.company_id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      action: 'approved',
      receipt: {
        receiptNumber,
        receiptDate: submission.payment_date,
        companyName: appData?.business_name || appData?.email || 'Company',
        collectionType: submission.invoice_id ? 'Monthly Incubation Fee' : 'Other Fees',
        invoiceNumber,
        billingMonth,
        amountPaid: amount,
        paymentMode: submission.payment_mode,
        transactionReference: submission.transaction_reference || null,
        receivedBy: user.email || 'Admin',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process submission' },
      { status: 500 }
    );
  }
}
