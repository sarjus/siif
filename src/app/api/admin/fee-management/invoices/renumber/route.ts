import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseClient, getRequestUser } from '@/lib/server-auth';

type Row = {
  id: string;
  invoice_number: string;
  billing_month: string;
  created_at: string | null;
};

// Renumbers all invoices sequentially per billing year, ordered by billing month then creation time.
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }
    const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
    if (role === 'company') {
      return NextResponse.json({ error: 'Company accounts cannot renumber invoices.' }, { status: 403 });
    }

    const databaseAdmin = createDatabaseClient();
    const { data, error } = await databaseAdmin
      .from('incubation_fee_invoices')
      .select('id, invoice_number, billing_month, created_at');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = ((data || []) as Row[]).filter((r) => r.billing_month);
    rows.sort(
      (a, b) =>
        String(a.billing_month).localeCompare(String(b.billing_month)) ||
        String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
        a.id.localeCompare(b.id)
    );

    const counters = new Map<string, number>();
    const targets = rows.map((row) => {
      const year = String(row.billing_month).slice(0, 4);
      const seq = (counters.get(year) || 0) + 1;
      counters.set(year, seq);
      return { row, number: `SIIF-INV-${year}-${String(seq).padStart(5, '0')}` };
    });

    const changes = targets.filter((t) => t.row.invoice_number !== t.number);

    // Two phases so the unique invoice_number constraint is never violated mid-way.
    for (const { row } of changes) {
      const { error: tmpError } = await databaseAdmin
        .from('incubation_fee_invoices')
        .update({ invoice_number: `TMP-${row.id}` })
        .eq('id', row.id);
      if (tmpError) {
        return NextResponse.json({ error: tmpError.message }, { status: 400 });
      }
    }
    for (const { row, number } of changes) {
      const { error: finalError } = await databaseAdmin
        .from('incubation_fee_invoices')
        .update({ invoice_number: number })
        .eq('id', row.id);
      if (finalError) {
        return NextResponse.json({ error: finalError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, updated: changes.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to renumber invoices' },
      { status: 500 }
    );
  }
}
