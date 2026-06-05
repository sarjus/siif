import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { computeInvoiceStatus } from '@/lib/fee-management';
import { getCompanyApplicationIdForUser, getRequestUser, isEffectiveAdminUser } from '@/lib/server-auth';
import { nextInvoiceNumber } from '@/lib/sequential-numbers';

type FeeSetting = {
  id: string;
  company_id: string;
  monthly_fee: number;
  start_date: string;
  due_day: number;
  grace_period_days: number;
  status: 'active' | 'inactive';
};

type InvoiceRecord = {
  id: string;
  company_id: string;
  invoice_number: string;
  billing_month: string;
  amount: number;
  amount_paid: number;
  due_date: string;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'void';
};

const getAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    throw new Error('Missing Supabase service role configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};


const toDateOnly = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient();
    const body = await request.json().catch(() => ({}));
    const companyId = typeof body?.companyId === 'string' ? body.companyId : null;
    const user = await getRequestUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isEffectiveAdminUser(user);

    if (!isAdmin) {
      if (!companyId) {
        return NextResponse.json({ error: 'Company ID is required.' }, { status: 400 });
      }

      const authorizedCompanyId = await getCompanyApplicationIdForUser(supabaseAdmin, user, companyId);
      if (!authorizedCompanyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let settingsQuery = supabaseAdmin
      .from('incubation_fee_settings')
      .select('id, company_id, monthly_fee, start_date, due_day, grace_period_days, status')
      .eq('status', 'active');

    if (companyId) {
      settingsQuery = settingsQuery.eq('company_id', companyId);
    }

    const { data: settings, error: settingsError } = await settingsQuery;
    if (settingsError) throw settingsError;

    // Load existing invoices to check for duplicates
    const { data: existingInvoices, error: invoicesError } = await supabaseAdmin
      .from('incubation_fee_invoices')
      .select('id, company_id, invoice_number, billing_month, amount, amount_paid, due_date, status');
    if (invoicesError) throw invoicesError;

    // Build a map keyed by company_id + YYYY-MM (month-only, no day)
    // This avoids mismatches caused by old records stored as 2026-05-31 vs new 2026-06-01
    const invoiceMap = new Map<string, InvoiceRecord>();
    (existingInvoices || []).forEach((invoice) => {
      const monthKey = (invoice.billing_month as string).slice(0, 7); // "YYYY-MM"
      invoiceMap.set(`${invoice.company_id}:${monthKey}`, invoice as InvoiceRecord);
    });

    const createdInvoices: Array<Record<string, unknown>> = [];
    const updatedInvoices: Array<Record<string, unknown>> = [];

    const now = new Date();
    // Current month = first day of this month (local time)
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (const setting of (settings || []) as FeeSetting[]) {
      // Only generate invoice for the current month — no backfilling old months
      const billingMonth = toDateOnly(currentMonth); // e.g. "2026-06-01"
      const billingMonthKey = currentMonthKey;        // e.g. "2026-06"
      const dueDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), setting.due_day);
      const mapKey = `${setting.company_id}:${billingMonthKey}`;
      const existing = invoiceMap.get(mapKey);

      // Skip if company's fee start date is after current month
      const [startY, startM] = setting.start_date.slice(0, 7).split('-').map(Number);
      const startMonthFirst = new Date(startY, startM - 1, 1);
      if (startMonthFirst > currentMonth) {
        continue;
      }

      if (!existing) {
        // No invoice for this month yet — create it
        const invoiceNumber = await nextInvoiceNumber(supabaseAdmin, currentMonth.getFullYear());
        createdInvoices.push({
          company_id: setting.company_id,
          invoice_number: invoiceNumber,
          billing_month: billingMonth,
          amount: setting.monthly_fee,
          amount_paid: 0,
          due_date: toDateOnly(dueDate),
          status: computeInvoiceStatus({
            amount: setting.monthly_fee,
            amountPaid: 0,
            dueDate: toDateOnly(dueDate),
            gracePeriodDays: setting.grace_period_days,
          }),
        });
      } else {
        // Invoice exists — skip voided ones, update status of others
        if (existing.status === 'void') {
          continue;
        }

        const computedStatus = computeInvoiceStatus({
          amount: Number(existing.amount || 0),
          amountPaid: Number(existing.amount_paid || 0),
          dueDate: existing.due_date,
          gracePeriodDays: setting.grace_period_days,
        });

        if (computedStatus !== existing.status) {
          updatedInvoices.push({ id: existing.id, status: computedStatus });
        }
      }
    }

    if (createdInvoices.length > 0) {
      const { error: createError } = await supabaseAdmin
        .from('incubation_fee_invoices')
        .insert(createdInvoices);
      if (createError) throw createError;
    }

    for (const invoice of updatedInvoices) {
      const { error: updateError } = await supabaseAdmin
        .from('incubation_fee_invoices')
        .update({ status: invoice.status })
        .eq('id', invoice.id);
      if (updateError) throw updateError;
    }

    return NextResponse.json({
      synced: true,
      created: createdInvoices.length,
      updated: updatedInvoices.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync invoices' },
      { status: 500 }
    );
  }
}
