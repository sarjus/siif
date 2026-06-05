import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { nextInvoiceNumber } from '@/lib/sequential-numbers';

type CompanyProfile = {
  id: string;
  business_name: string | null;
  lead_name: string | null;
  email: string;
  status: string;
};

type FeeSettingWithCompany = {
  id: string;
  company_id: string;
  monthly_fee: number;
  start_date: string;
  due_day: number;
  grace_period_days: number;
  status: 'active' | 'inactive';
  applications: CompanyProfile | null;
};

type CreatedInvoice = {
  id: string;
  company_id: string;
  invoice_number: string;
  billing_month: string;
  amount: number;
  due_date: string;
};

export type MonthlyFeeCycleResult = {
  ran: boolean;
  reason?: string;
  month?: string;
  created: number;
  notificationsCreated: number;
  emailsSent: number;
  emailErrors: string[];
  utcDate: string;
  message?: string;
};

const sanitizeEnv = (value?: string | null) => (value ?? '').trim();
const stripWrappingQuotes = (value: string) => value.replace(/^['"]+|['"]+$/g, '');

const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const getTransporter = () => {
  const smtpHost = sanitizeEnv(process.env.SMTP_HOST);
  const smtpPort = sanitizeEnv(process.env.SMTP_PORT);
  const smtpUser = sanitizeEnv(process.env.SMTP_USER);
  const smtpPass = sanitizeEnv(process.env.SMTP_PASS);

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    return null;
  }

  const parsedPort = parseInt(smtpPort, 10);
  if (Number.isNaN(parsedPort)) return null;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parsedPort,
    secure: parsedPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const mailFromRaw = sanitizeEnv(process.env.MAIL_FROM) || smtpUser;
  return {
    transporter,
    mailFrom: stripWrappingQuotes(mailFromRaw),
  };
};

const toDateOnlyUtc = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFirstInvoiceMonth = (startDate: string, dueDay: number) => {
  const start = new Date(startDate);
  const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  if (start.getUTCDate() > dueDay) {
    month.setUTCMonth(month.getUTCMonth() + 1);
  }
  return month;
};

const currentMonthStartUtc = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export async function runMonthlyFeeCycle(force: boolean): Promise<MonthlyFeeCycleResult> {
  const now = new Date();

  if (!force && now.getUTCDate() !== 1) {
    return {
      ran: false,
      reason: 'Skipped because today is not the 1st day of month (UTC).',
      created: 0,
      notificationsCreated: 0,
      emailsSent: 0,
      emailErrors: [],
      utcDate: now.toISOString(),
    };
  }

  const supabaseAdmin = getAdminClient();
  const monthStart = currentMonthStartUtc(now);
  const billingMonth = toDateOnlyUtc(monthStart);

  const { data: settingsData, error: settingsError } = await supabaseAdmin
    .from('incubation_fee_settings')
    .select(
      'id, company_id, monthly_fee, start_date, due_day, grace_period_days, status, applications(id, business_name, lead_name, email, status)'
    )
    .eq('status', 'active');
  if (settingsError) throw settingsError;

  const settings = (settingsData || []) as unknown as FeeSettingWithCompany[];
  const eligibleSettings = settings.filter((setting) => {
    if (!setting.applications || setting.applications.status !== 'approved') return false;
    const firstMonth = getFirstInvoiceMonth(setting.start_date, setting.due_day);
    return firstMonth <= monthStart;
  });

  if (eligibleSettings.length === 0) {
    return {
      ran: true,
      month: billingMonth,
      created: 0,
      notificationsCreated: 0,
      emailsSent: 0,
      emailErrors: [],
      utcDate: now.toISOString(),
      message: 'No eligible active fee settings found for invoice generation.',
    };
  }

  const companyIds = eligibleSettings.map((setting) => setting.company_id);
  const { data: existingInvoices, error: existingError } = await supabaseAdmin
    .from('incubation_fee_invoices')
    .select('company_id, billing_month')
    .in('company_id', companyIds)
    .eq('billing_month', billingMonth);
  if (existingError) throw existingError;

  const existingKeys = new Set(
    (existingInvoices || []).map((row) => `${row.company_id}:${row.billing_month}`)
  );

  const invoicesToCreate: Array<{
    company_id: string;
    invoice_number: string;
    billing_month: string;
    amount: number;
    amount_paid: number;
    due_date: string;
    status: string;
    remarks: string;
  }> = [];

  for (const setting of eligibleSettings.filter(
    (s) => !existingKeys.has(`${s.company_id}:${billingMonth}`)
  )) {
    const dueDate = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), setting.due_day)
    );
    const invoiceNumber = await nextInvoiceNumber(
      supabaseAdmin,
      monthStart.getUTCFullYear()
    );
    invoicesToCreate.push({
      company_id: setting.company_id,
      invoice_number: invoiceNumber,
      billing_month: billingMonth,
      amount: Number(setting.monthly_fee || 0),
      amount_paid: 0,
      due_date: toDateOnlyUtc(dueDate),
      status: 'pending',
      remarks: 'Auto-generated on month start.',
    });
  }

  let createdInvoices: CreatedInvoice[] = [];
  if (invoicesToCreate.length > 0) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('incubation_fee_invoices')
      .insert(invoicesToCreate)
      .select('id, company_id, invoice_number, billing_month, amount, due_date');
    if (insertError) throw insertError;
    createdInvoices = (inserted || []) as CreatedInvoice[];
  }

  const settingsByCompanyId = new Map(
    eligibleSettings.map((setting) => [setting.company_id, setting])
  );

  const notificationRows = createdInvoices
    .map((invoice) => {
      const setting = settingsByCompanyId.get(invoice.company_id);
      if (!setting?.applications) return null;

      return {
        title: `Monthly Invoice Generated: ${invoice.invoice_number}`,
        message: `Your incubation fee invoice for ${billingMonth} has been generated. Amount: INR ${Number(invoice.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Due Date: ${invoice.due_date}.`,
        recipient_type: 'company_specific',
        company_id: invoice.company_id,
        sent_by: 'System Cron',
      };
    })
    .filter(Boolean);

  if (notificationRows.length > 0) {
    const { error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert(notificationRows);
    if (notificationError) throw notificationError;
  }

  const mailConfig = getTransporter();
  let emailsSent = 0;
  const emailErrors: string[] = [];

  if (mailConfig) {
    for (const invoice of createdInvoices) {
      const setting = settingsByCompanyId.get(invoice.company_id);
      const profile = setting?.applications;
      if (!profile?.email) continue;

      const subject = `SIIF Monthly Invoice Generated - ${invoice.invoice_number}`;
      const text = [
        `Dear ${profile.lead_name || 'Founder'},`,
        '',
        `${profile.business_name || 'Your company'} monthly incubation invoice has been generated.`,
        `Invoice Number: ${invoice.invoice_number}`,
        `Billing Month: ${invoice.billing_month}`,
        `Amount: INR ${Number(invoice.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Due Date: ${invoice.due_date}`,
        '',
        'Please log in to your SIIF company dashboard for details.',
        '',
        'SIIF Team',
      ].join('\n');

      const html = `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <p>Dear ${profile.lead_name || 'Founder'},</p>
          <p><strong>${profile.business_name || 'Your company'}</strong> monthly incubation invoice has been generated.</p>
          <p>
            <strong>Invoice Number:</strong> ${invoice.invoice_number}<br/>
            <strong>Billing Month:</strong> ${invoice.billing_month}<br/>
            <strong>Amount:</strong> INR ${Number(invoice.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>
            <strong>Due Date:</strong> ${invoice.due_date}
          </p>
          <p>Please log in to your SIIF company dashboard for details.</p>
          <p>SIIF Team</p>
        </div>
      `;

      try {
        await mailConfig.transporter.sendMail({
          from: mailConfig.mailFrom,
          to: profile.email,
          subject,
          text,
          html,
        });
        emailsSent += 1;
      } catch (error) {
        emailErrors.push(
          `Failed to send invoice email for ${invoice.invoice_number}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  return {
    ran: true,
    month: billingMonth,
    created: createdInvoices.length,
    notificationsCreated: notificationRows.length,
    emailsSent,
    emailErrors,
    utcDate: now.toISOString(),
  };
}
