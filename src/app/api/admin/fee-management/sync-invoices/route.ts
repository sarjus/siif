import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { buildInvoiceNumber, computeInvoiceStatus } from '@/lib/fee-management';
import { getCompanyApplicationIdForUser, getRequestUser, isAdminUser } from '@/lib/server-auth';

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
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
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

const getFirstInvoiceMonth = (startDate: string, dueDay: number) => {
  const start = new Date(startDate);
  const month = new Date(start.getFullYear(), start.getMonth(), 1);
  if (start.getDate() > dueDay) {
    month.setMonth(month.getMonth() + 1);
  }
  return month;
};

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient();
    const body = await request.json().catch(() => ({}));
    const companyId = typeof body?.companyId === 'string' ? body.companyId : null;
    const user = await getRequestUser(request);
    const isAdmin = isAdminUser(user);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const { data: existingInvoices, error: invoicesError } = await supabaseAdmin
      .from('incubation_fee_invoices')
      .select('id, company_id, invoice_number, billing_month, amount, amount_paid, due_date, status');
    if (invoicesError) throw invoicesError;

    const invoiceMap = new Map<string, InvoiceRecord>();
    (existingInvoices || []).forEach((invoice) => {
      invoiceMap.set(`${invoice.company_id}:${invoice.billing_month}`, invoice as InvoiceRecord);
    });

    const createdInvoices: Array<Record<string, unknown>> = [];
    const updatedInvoices: Array<Record<string, unknown>> = [];
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const setting of (settings || []) as FeeSetting[]) {
      const firstMonth = getFirstInvoiceMonth(setting.start_date, setting.due_day);
      const cursor = new Date(firstMonth);

      while (cursor <= currentMonth) {
        const billingMonth = toDateOnly(cursor);
        const dueDate = new Date(cursor.getFullYear(), cursor.getMonth(), setting.due_day);
        const mapKey = `${setting.company_id}:${billingMonth}`;
        const existing = invoiceMap.get(mapKey);

        if (!existing) {
          createdInvoices.push({
            company_id: setting.company_id,
            invoice_number: buildInvoiceNumber(setting.company_id, billingMonth),
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

        cursor.setMonth(cursor.getMonth() + 1);
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
