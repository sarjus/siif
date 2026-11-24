import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2/promise';
import { getMysqlPool } from '@/lib/mysql';
import { requireAdmin } from '@/lib/server-auth';

export async function PATCH(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { invoiceId, amount } = await request.json() as { invoiceId?: unknown; amount?: unknown };
    if (typeof invoiceId !== 'string' || !invoiceId.trim()) {
      return NextResponse.json({ error: 'Invoice ID is required.' }, { status: 400 });
    }
    if (typeof amount !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(amount)) {
      return NextResponse.json({ error: 'Enter a valid amount with at most two decimal places.' }, { status: 400 });
    }

    const value = Number(amount);
    const [result] = await getMysqlPool().execute<ResultSetHeader>(
      `UPDATE incubation_fee_invoices AS invoice
       LEFT JOIN incubation_fee_settings AS setting ON setting.company_id = invoice.company_id
       SET invoice.amount = ?,
           invoice.status = CASE
             WHEN ? = 0 THEN 'paid'
             WHEN ? > DATE_ADD(invoice.due_date, INTERVAL COALESCE(setting.grace_period_days, 0) DAY) THEN 'overdue'
             ELSE 'pending'
           END
       WHERE invoice.id = ? AND invoice.amount_paid = 0
         AND invoice.status IN ('pending', 'overdue')
         AND NOT EXISTS (
           SELECT 1 FROM fee_collections AS collection
           WHERE collection.invoice_id = invoice.id AND collection.status = 'recorded'
         )`,
      [value, value, new Date(), invoiceId.trim()]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: 'Invoice not found or no longer eligible for editing. Refresh the invoice list.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update invoice amount.' },
      { status: 500 }
    );
  }
}
