import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';
import { computeDepositStatus } from '@/lib/fee-management';
import { nextReceiptNumber } from '@/lib/sequential-numbers';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabaseAdmin = createServiceRoleClient();

    const [{ data: companies, error: compError }, { data: deposits, error: depError }] = await Promise.all([
      supabaseAdmin.from('applications').select('id, business_name, email').eq('status', 'approved').order('business_name', { ascending: true }),
      supabaseAdmin.from('company_deposits').select('*, applications(business_name, email)').order('created_at', { ascending: false }),
    ]);

    if (compError) return NextResponse.json({ error: compError.message }, { status: 400 });
    if (depError) return NextResponse.json({ error: depError.message }, { status: 400 });

    return NextResponse.json({ companies: companies || [], deposits: deposits || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load deposits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { companyId, depositId, action, amount, collectionDate, paymentMode, transactionReference, remarks, existingDeposit } = await request.json();

    if (!companyId || !depositId || !amount || !collectionDate || !paymentMode) {
      return NextResponse.json({ error: 'All required fields must be provided.' }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    const amountCollected = action === 'collect'
      ? Number(existingDeposit.amount_collected || 0) + numAmount
      : Number(existingDeposit.amount_collected || 0);
    const amountRefunded = action === 'refund'
      ? Number(existingDeposit.amount_refunded || 0) + numAmount
      : Number(existingDeposit.amount_refunded || 0);
    const status = computeDepositStatus({ depositAmount: Number(existingDeposit.deposit_amount || 0), amountCollected, amountRefunded });

    const { error: depositError } = await supabaseAdmin
      .from('company_deposits')
      .update({
        amount_collected: amountCollected,
        amount_refunded: amountRefunded,
        balance_amount: Math.max(Number(existingDeposit.deposit_amount || 0) - amountCollected + amountRefunded, 0),
        collection_date: action === 'collect' ? collectionDate : existingDeposit.collection_date,
        refund_date: action === 'refund' ? collectionDate : existingDeposit.refund_date,
        status,
        remarks: remarks || existingDeposit.remarks,
      })
      .eq('id', depositId);

    if (depositError) return NextResponse.json({ error: depositError.message }, { status: 400 });

    const receiptNumber = await nextReceiptNumber(supabaseAdmin);
    const collectionType = action === 'collect' ? 'refundable_deposit' : 'deposit_refund';

    const { error: collectionError } = await supabaseAdmin.from('fee_collections').insert({
      company_id: companyId,
      receipt_number: receiptNumber,
      collection_type: collectionType,
      deposit_id: depositId,
      collection_date: collectionDate,
      amount_collected: numAmount,
      payment_mode: paymentMode,
      transaction_reference: transactionReference || null,
      collected_by: user.email || 'Admin',
      remarks: remarks || null,
      status: 'recorded',
    });

    if (collectionError) return NextResponse.json({ error: collectionError.message }, { status: 400 });

    // Fetch company name for receipt
    const { data: appData } = await supabaseAdmin.from('applications').select('business_name, email').eq('id', companyId).maybeSingle();

    return NextResponse.json({
      success: true,
      receipt: {
        receiptNumber,
        receiptDate: collectionDate,
        companyName: appData?.business_name || appData?.email || 'Company',
        collectionType: action === 'collect' ? 'Refundable Deposit' : 'Deposit Refund',
        depositReference: depositId,
        amountPaid: numAmount,
        paymentMode,
        transactionReference: transactionReference || null,
        receivedBy: user.email || 'Admin',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to record deposit' }, { status: 500 });
  }
}
