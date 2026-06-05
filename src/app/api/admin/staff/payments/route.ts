import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';
import { nextPaymentNumber } from '@/lib/sequential-numbers';

// GET — list all staff payments (with optional staff_id filter)
export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabaseAdmin = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');

    let query = supabaseAdmin
      .from('siif_staff_payments')
      .select('*, siif_staff(name, designation, payment_type)')
      .order('payment_month', { ascending: false })
      .order('payment_number', { ascending: false });

    if (staffId) query = query.eq('staff_id', staffId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ payments: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load payments' }, { status: 500 });
  }
}

// POST — record a staff payment
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const body = await request.json();
    const { staffId, paymentType, paymentMonth, amount, paymentMode, paymentDate, transactionReference, remarks } = body;

    if (!staffId || !paymentType || !paymentMonth || !amount || !paymentMode || !paymentDate) {
      return NextResponse.json({ error: 'Staff, payment type, month, amount, mode, and date are required.' }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify staff exists
    const { data: staff } = await supabaseAdmin
      .from('siif_staff')
      .select('id, name, designation, payment_type')
      .eq('id', staffId)
      .maybeSingle();

    if (!staff) return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });

    // Generate sequential payment number
    const paymentNumber = await nextPaymentNumber(supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from('siif_staff_payments')
      .insert({
        payment_number: paymentNumber,
        staff_id: staffId,
        payment_type: paymentType,
        payment_month: paymentMonth,
        amount: numAmount,
        payment_mode: paymentMode,
        payment_date: paymentDate,
        transaction_reference: transactionReference?.trim() || null,
        paid_by: user.email || 'Admin',
        remarks: remarks?.trim() || null,
      })
      .select('*, siif_staff(name, designation)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      success: true,
      payment: data,
      slip: {
        paymentNumber,
        paymentDate,
        paymentMonth,
        staffName: staff.name,
        designation: staff.designation,
        paymentType,
        amount: numAmount,
        paymentMode,
        transactionReference: transactionReference || null,
        paidBy: user.email || 'Admin',
        remarks: remarks || null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to record payment' }, { status: 500 });
  }
}
