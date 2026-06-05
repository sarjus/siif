import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

// GET — list entries with optional date range filter
export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const supabase = createServiceRoleClient();
    let query = supabase
      .from('siif_ledger')
      .select('*')
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (from) query = query.gte('entry_date', from);
    if (to) query = query.lte('entry_date', to);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ entries: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load ledger' }, { status: 500 });
  }
}

// POST — create new entry
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const body = await request.json() as {
      entryDate?: string;
      particulars?: string;
      debit?: number;
      credit?: number;
      category?: string;
      reference?: string;
      notes?: string;
    };

    const { entryDate, particulars, debit, credit, category, reference, notes } = body;

    if (!entryDate || !particulars?.trim()) {
      return NextResponse.json({ error: 'Date and particulars are required.' }, { status: 400 });
    }

    const debitAmt = Number(debit || 0);
    const creditAmt = Number(credit || 0);

    if (debitAmt < 0 || creditAmt < 0) {
      return NextResponse.json({ error: 'Debit and credit amounts cannot be negative.' }, { status: 400 });
    }
    if (debitAmt === 0 && creditAmt === 0) {
      return NextResponse.json({ error: 'Either debit or credit must be greater than zero.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('siif_ledger')
      .insert({
        entry_date: entryDate,
        particulars: particulars.trim(),
        debit: debitAmt,
        credit: creditAmt,
        category: category?.trim() || null,
        reference: reference?.trim() || null,
        entered_by: user.email || 'Admin',
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ entry: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create entry' }, { status: 500 });
  }
}

// DELETE — remove an entry
export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { entryId } = await request.json() as { entryId?: string };
    if (!entryId) return NextResponse.json({ error: 'Entry ID is required.' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('siif_ledger').delete().eq('id', entryId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete entry' }, { status: 500 });
  }
}
