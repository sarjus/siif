import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, getRequestUser, isEffectiveAdminUser } from '@/lib/server-auth';
import { buildInvoiceNumber } from '@/lib/fee-management';

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isEffectiveAdminUser(user);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { fromMonth, toMonth } = (await request.json()) as {
      fromMonth?: string;
      toMonth?: string;
    };

    if (!fromMonth || !toMonth) {
      return NextResponse.json({ error: 'fromMonth and toMonth are required (YYYY-MM-DD format).' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    // Fetch all invoices with the old billing month (non-void)
    const { data: invoices, error: fetchError } = await supabaseAdmin
      .from('incubation_fee_invoices')
      .select('id, company_id, due_date')
      .eq('billing_month', fromMonth)
      .neq('status', 'void');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No invoices found for the given billing month.' });
    }

    // Parse toMonth as local date components to avoid UTC timezone rollback
    const [toYear, toMon] = toMonth.slice(0, 10).split('-').map(Number);
    let updatedCount = 0;

    for (const invoice of invoices) {
      // Parse due_date components to preserve the due day in the new month
      const [, , dueDay] = invoice.due_date.slice(0, 10).split('-').map(Number);
      const newDueDateStr = `${toYear}-${String(toMon).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
      const newInvoiceNumber = buildInvoiceNumber(invoice.company_id, toMonth);

      // Check if target billing_month already exists for this company (to avoid unique constraint violation)
      const { data: conflict } = await supabaseAdmin
        .from('incubation_fee_invoices')
        .select('id')
        .eq('company_id', invoice.company_id)
        .eq('billing_month', toMonth)
        .neq('id', invoice.id)
        .maybeSingle();

      if (conflict) {
        // Target month invoice already exists — delete the old May one instead
        await supabaseAdmin
          .from('incubation_fee_invoices')
          .update({ status: 'void', updated_at: new Date().toISOString() })
          .eq('id', invoice.id);
        updatedCount++;
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from('incubation_fee_invoices')
        .update({
          billing_month: toMonth,
          due_date: newDueDateStr,
          invoice_number: newInvoiceNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (updateError) {
        return NextResponse.json({ error: `Failed to update invoice ${invoice.id}: ${updateError.message}` }, { status: 400 });
      }

      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      message: `Successfully updated ${updatedCount} invoice(s) from ${fromMonth} to ${toMonth}.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update billing month' },
      { status: 500 }
    );
  }
}
