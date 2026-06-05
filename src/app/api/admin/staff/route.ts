import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

// GET — list all staff
export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabaseAdmin = createServiceRoleClient();
    const { data, error } = await supabaseAdmin
      .from('siif_staff')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ staff: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load staff' }, { status: 500 });
  }
}

// POST — create or update staff
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const body = await request.json();
    const { id, name, designation, paymentType, amount, bankAccount, ifsc, email, phone, isActive, notes } = body;

    if (!name || !designation || !paymentType) {
      return NextResponse.json({ error: 'Name, designation, and payment type are required.' }, { status: 400 });
    }
    if (!['salary', 'honorarium'].includes(paymentType)) {
      return NextResponse.json({ error: 'Payment type must be salary or honorarium.' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();
    const record = {
      name: name.trim(),
      designation: designation.trim(),
      payment_type: paymentType,
      amount: Number(amount || 0),
      bank_account: bankAccount?.trim() || null,
      ifsc: ifsc?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      is_active: isActive !== false,
      notes: notes?.trim() || null,
    };

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('siif_staff')
        .update(record)
        .eq('id', id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ staff: data });
    } else {
      const { data, error } = await supabaseAdmin
        .from('siif_staff')
        .insert(record)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ staff: data });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save staff' }, { status: 500 });
  }
}
