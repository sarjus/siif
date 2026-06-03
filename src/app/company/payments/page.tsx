'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import CompanyShell from '@/components/CompanyShell';
import { Building2, Download, IndianRupee, ReceiptText, ShieldCheck, WalletCards, type LucideIcon } from 'lucide-react';
import { DEPOSIT_STATUS_COLORS, downloadReceiptPdf, formatBillingMonth, formatCurrency, INVOICE_STATUS_COLORS, PAYMENT_MODE_OPTIONS, PaymentMode } from '@/lib/fee-management';

const BANK_DETAILS = {
  accountName: 'SJCET Innovation and Incubation Foundation',
  accountNumber: '45112620593',
  ifsc: 'SBIN0070350',
  bank: 'State Bank of India',
  branch: 'Bharananganam Branch',
};


type CompanyProfile = {
  id: string;
  business_name: string | null;
  lead_name: string | null;
  email: string;
  status: string;
  updated_at: string | null;
  submitted_at: string | null;
};

type FeeSetting = {
  monthly_fee?: number | null;
  start_date?: string | null;
  due_day?: number | null;
  status?: string | null;
};

type Deposit = {
  deposit_amount?: number | null;
  amount_collected?: number | null;
  amount_refunded?: number | null;
  balance_amount?: number | null;
  status?: keyof typeof DEPOSIT_STATUS_COLORS | string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  billing_month: string;
  amount: number;
  amount_paid: number;
  due_date: string;
  status: keyof typeof INVOICE_STATUS_COLORS | string;
};

type Collection = {
  id: string;
  receipt_number: string;
  collection_type: string;
  collection_date: string;
  amount_collected: number;
  payment_mode: string;
  transaction_reference: string | null;
  collected_by: string | null;
  deposit_id: string | null;
  incubation_fee_invoices?: {
    invoice_number?: string | null;
    billing_month?: string | null;
  } | null;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  sent_at: string;
};

type PaymentSubmission = {
  id: string;
  amount_paid: number;
  payment_mode: string;
  transaction_reference: string | null;
  payment_date: string;
  remarks: string | null;
  status: 'pending' | 'approved' | 'rejected';
  receipt_number: string | null;
  created_at: string;
  incubation_fee_invoices?: { invoice_number: string | null; billing_month: string | null } | null;
};

export default function CompanyPaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [setting, setSetting] = useState<FeeSetting | null>(null);
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [submitForm, setSubmitForm] = useState({
    invoiceId: '',
    amountPaid: '',
    paymentMode: 'bank_transfer' as PaymentMode,
    transactionReference: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    remarks: '',
  });

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }
      const user = session.user;
      const userEmail = (user.email || '').trim().toLowerCase();
      if (String(user.user_metadata?.role || '') !== 'company') {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      const { data: appData, error: appError } = await supabase
        .from('applications')
        .select('id, business_name, lead_name, email, status, updated_at, submitted_at')
        .ilike('email', userEmail)
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (appError || !appData) throw new Error('Approved company profile not found.');
      setCompany(appData as CompanyProfile);

      await fetch('/api/admin/fee-management/sync-invoices', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: appData.id }),
      });

      const [{ data: settingData }, { data: depositData }, { data: invoiceData }, { data: collectionData }, { data: notificationData }] = await Promise.all([
        supabase.from('incubation_fee_settings').select('*').eq('company_id', appData.id).maybeSingle(),
        supabase.from('company_deposits').select('*').eq('company_id', appData.id).maybeSingle(),
        supabase.from('incubation_fee_invoices').select('*').eq('company_id', appData.id).order('billing_month', { ascending: false }),
        supabase.from('fee_collections').select('*, incubation_fee_invoices(invoice_number, billing_month)').eq('company_id', appData.id).order('collection_date', { ascending: false }),
        supabase.from('notifications').select('*').or(`company_id.eq.${appData.id},recipient_type.eq.all`).order('sent_at', { ascending: false }),
      ]);

      setSetting((settingData || null) as FeeSetting | null);
      setDeposit((depositData || null) as Deposit | null);
      setInvoices((invoiceData || []) as Invoice[]);
      setCollections((collectionData || []) as Collection[]);
      setNotifications((notificationData || []) as Notification[]);

      // Load company's payment submissions
      const submissionsRes = await fetch(`/api/company/payment-submissions?companyId=${appData.id}`, {
        headers: await getAuthHeaders(),
      });
      if (submissionsRes.ok) {
        const submissionsPayload = await submissionsRes.json();
        setSubmissions((submissionsPayload.submissions || []) as PaymentSubmission[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment history');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSubmitPayment = async () => {
    if (!company) return;
    if (!submitForm.amountPaid || !submitForm.paymentMode || !submitForm.paymentDate) {
      setSubmitError('Amount, payment mode and date are required.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSubmitNotice(null);
    try {
      const response = await fetch('/api/company/payment-submissions', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          invoiceId: submitForm.invoiceId || null,
          amountPaid: Number(submitForm.amountPaid),
          paymentMode: submitForm.paymentMode,
          transactionReference: submitForm.transactionReference || null,
          paymentDate: submitForm.paymentDate,
          remarks: submitForm.remarks || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to submit payment details');
      setSubmitNotice('Payment details submitted successfully. Admin will verify and generate your receipt.');
      setSubmitForm({ invoiceId: '', amountPaid: '', paymentMode: 'bank_transfer', transactionReference: '', paymentDate: new Date().toISOString().slice(0, 10), remarks: '' });
      setShowSubmitForm(false);
      await loadData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const notices = useMemo(() => {
    const rows: Array<{ message: string; color: string }> = [];
    const currentInvoice = invoices.find((item) => item.status !== 'paid');
    if (currentInvoice) {
      const dueDate = new Date(currentInvoice.due_date);
      const today = new Date();
      const label = formatBillingMonth(currentInvoice.billing_month);
      if (today.toDateString() === dueDate.toDateString()) {
        rows.push({ message: 'Your incubation fee payment is due today.', color: '#DC2626' });
      } else if (today > dueDate) {
        rows.push({ message: `Your incubation fee payment for ${label} is overdue. Please make payment immediately.`, color: '#DC2626' });
      } else {
        rows.push({ message: `Your incubation fee for ${label} is due on ${dueDate.toLocaleDateString('en-IN')}.`, color: '#2AA0D3' });
      }
    }

    if (deposit?.status === 'pending') rows.push({ message: 'Your refundable security deposit is pending.', color: '#F59E0B' });
    if (deposit?.status === 'collected') rows.push({ message: 'Your refundable security deposit has been successfully collected.', color: '#16A34A' });
    if (deposit?.status === 'refunded') rows.push({ message: 'Your refundable security deposit has been refunded.', color: '#6B7280' });
    return rows;
  }, [deposit, invoices]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <CompanyShell
      title="Payment History"
      subtitle="Review fee configuration, outstanding dues, deposit status, and downloadable receipts."
      companyName={company?.business_name || company?.email}
      onLogout={handleLogout}
    >
        {error && <div className="mb-6 rounded-lg border border-[#FFC9C9] bg-[#FFF1F1] p-4 text-sm font-medium text-[#B42318]">{error}</div>}
        {notices.map((notice, index) => <div key={`${notice.message}-${index}`} className="mb-4 rounded-lg p-4 text-sm font-semibold text-white" style={{ backgroundColor: notice.color }}>{notice.message}</div>)}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ['Outstanding Dues', formatCurrency(invoices.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + Math.max(Number(item.amount || 0) - Number(item.amount_paid || 0), 0), 0)), '#DC2626', IndianRupee],
              ['Monthly Fee', formatCurrency(setting?.monthly_fee || 0), '#FF3B3B', ReceiptText],
              ...(Number(deposit?.deposit_amount || 0) > 0 ? [['Deposit Balance', formatCurrency(deposit?.balance_amount || 0), '#2AA0D3', WalletCards] as [string, string, string, typeof WalletCards]] : []),
              ['Total Paid', formatCurrency(collections.reduce((sum, item) => sum + Number(item.amount_collected || 0), 0)), '#16A34A', ShieldCheck],
            ] as Array<[string, string, string, LucideIcon]>
          ).map(([label, value, color, Icon]) => (
            <Card key={String(label)} className="rounded-lg border border-[#E3E7EE] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">{label}</p>
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                </div>
                <span className="rounded-lg bg-[#F4F6F8] p-2" style={{ color }}>
                  <Icon className="size-5" />
                </span>
              </div>
            </Card>
          ))}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="rounded-lg border border-[#E3E7EE] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-[#172033]">Fee Configuration Details</h3>
            <div className="space-y-2 text-sm text-[#4A5568]">
              <p><strong>Company:</strong> {company?.business_name || '-'}</p>
              <p><strong>Lead Entrepreneur:</strong> {company?.lead_name || '-'}</p>
              <p><strong>Monthly Fee:</strong> {formatCurrency(setting?.monthly_fee || 0)}</p>
              <p><strong>Start Date:</strong> {setting?.start_date || '-'}</p>
              <p><strong>Due Day:</strong> {setting?.due_day || '-'}</p>
              <p><strong>Status:</strong> {setting?.status || '-'}</p>
            </div>
          </Card>
          {Number(deposit?.deposit_amount || 0) > 0 && (
            <Card className="rounded-lg border border-[#E3E7EE] bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-[#172033]">Refundable Deposit Details</h3>
              <div className="space-y-2 text-sm text-[#4A5568]">
                <p><strong>Configured Deposit:</strong> {formatCurrency(deposit?.deposit_amount || 0)}</p>
                <p><strong>Collected:</strong> {formatCurrency(deposit?.amount_collected || 0)}</p>
                <p><strong>Refunded:</strong> {formatCurrency(deposit?.amount_refunded || 0)}</p>
                <p><strong>Balance:</strong> {formatCurrency(deposit?.balance_amount || 0)}</p>
                {deposit?.status && <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: DEPOSIT_STATUS_COLORS[deposit.status as keyof typeof DEPOSIT_STATUS_COLORS] }}>{deposit.status.replace('_', ' ')}</span>}
              </div>
            </Card>
          )}
          <Card className="rounded-lg border border-[#E3E7EE] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-[#172033]">Notification History</h3>
            <div className="space-y-3 max-h-[240px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-[#667085]">No notifications yet.</div>
              ) : notifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-[#4A4A4A]">{notification.title}</p>
                  <p className="mt-1 text-xs text-[#666666]">{notification.message}</p>
                  <p className="mt-2 text-[11px] text-[#8A8A8A]">{new Date(notification.sent_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Bank Account Details */}
        <Card className="mb-6 rounded-lg border border-[#E3E7EE] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="size-5 text-[#FF3B3B]" />
            <h3 className="text-lg font-bold text-[#172033]">Payment Bank Account Details</h3>
          </div>
          <p className="mb-4 text-sm text-[#667085]">
            Please transfer your fees to the following bank account and submit the payment details below for verification.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-[#E3E7EE] bg-[#F8FAFC] p-4 text-sm">
            {[
              ['Account Name', BANK_DETAILS.accountName],
              ['Account Number', BANK_DETAILS.accountNumber],
              ['IFSC Code', BANK_DETAILS.ifsc],
              ['Bank', BANK_DETAILS.bank],
              ['Branch', BANK_DETAILS.branch],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-semibold uppercase text-[#8A8A8A]">{label}</p>
                <p className="mt-0.5 font-semibold text-[#172033] select-all">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-[#8A8A8A]">After making the transfer, click the button to submit your payment details for admin verification.</p>
            <button
              onClick={() => { setShowSubmitForm((v) => !v); setSubmitError(null); setSubmitNotice(null); }}
              className="ml-4 shrink-0 rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all"
            >
              {showSubmitForm ? 'Cancel' : 'Submit Payment Details'}
            </button>
          </div>

          {submitNotice && (
            <div className="mt-4 rounded-lg bg-[#EAF9F0] p-4 text-sm font-medium text-[#1E7F46]">{submitNotice}</div>
          )}

          {showSubmitForm && (
            <div className="mt-5 border-t border-[#E3E7EE] pt-5">
              <h4 className="mb-4 font-bold text-[#172033]">Enter Payment Details</h4>
              {submitError && <div className="mb-4 rounded-lg bg-[#FFF1F1] p-3 text-sm text-[#B42318]">{submitError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Invoice (optional)</label>
                  <select
                    value={submitForm.invoiceId}
                    onChange={(e) => setSubmitForm((p) => ({ ...p, invoiceId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  >
                    <option value="">Select invoice (if applicable)</option>
                    {invoices.filter((inv) => inv.status !== 'paid' && inv.status !== 'void').map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} | {formatBillingMonth(inv.billing_month)} | Balance {formatCurrency(Number(inv.amount) - Number(inv.amount_paid))}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Amount Paid (₹)</label>
                  <input
                    type="number"
                    value={submitForm.amountPaid}
                    onChange={(e) => setSubmitForm((p) => ({ ...p, amountPaid: e.target.value }))}
                    placeholder="Enter amount"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Payment Mode</label>
                  <select
                    value={submitForm.paymentMode}
                    onChange={(e) => setSubmitForm((p) => ({ ...p, paymentMode: e.target.value as PaymentMode }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  >
                    {PAYMENT_MODE_OPTIONS.map((mode) => (
                      <option key={mode.value} value={mode.value}>{mode.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Transaction Reference / UTR</label>
                  <input
                    value={submitForm.transactionReference}
                    onChange={(e) => setSubmitForm((p) => ({ ...p, transactionReference: e.target.value }))}
                    placeholder="e.g. UTR number, cheque no."
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Payment Date</label>
                  <input
                    type="date"
                    value={submitForm.paymentDate}
                    onChange={(e) => setSubmitForm((p) => ({ ...p, paymentDate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Remarks (optional)</label>
                  <input
                    value={submitForm.remarks}
                    onChange={(e) => setSubmitForm((p) => ({ ...p, remarks: e.target.value }))}
                    placeholder="Any additional notes"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={handleSubmitPayment}
                disabled={submitting}
                className="mt-4 rounded-lg bg-[#FF3B3B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit for Verification'}
              </button>
            </div>
          )}
        </Card>

        {/* My Submission History */}
        {submissions.length > 0 && (
          <Card className="mb-6 overflow-hidden rounded-lg border border-[#E3E7EE] bg-white shadow-sm">
            <div className="border-b border-[#E3E7EE] p-4">
              <h3 className="text-lg font-bold text-[#172033]">My Payment Submissions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F5F6F7' }}>
                    {['Date', 'Invoice', 'Amount', 'Mode', 'UTR / Reference', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-sm text-[#4A4A4A]">{sub.payment_date}</td>
                      <td className="px-4 py-3 text-sm text-[#4A4A4A]">
                        {sub.incubation_fee_invoices?.invoice_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#4A4A4A]">{formatCurrency(sub.amount_paid)}</td>
                      <td className="px-4 py-3 text-sm text-[#4A4A4A]">{sub.payment_mode.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm text-[#4A4A4A]">{sub.transaction_reference || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${
                          sub.status === 'approved' ? 'bg-[#16A34A]' :
                          sub.status === 'rejected' ? 'bg-[#DC2626]' :
                          'bg-[#F59E0B]'
                        }`}>
                          {sub.status === 'approved' ? `Approved${sub.receipt_number ? ` · ${sub.receipt_number}` : ''}` : sub.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className="mb-6 overflow-hidden rounded-lg border border-[#E3E7EE] bg-white shadow-sm">
          <div className="border-b border-[#E3E7EE] p-4"><h3 className="text-lg font-bold text-[#172033]">Outstanding Dues & Invoices</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Invoice', 'Billing Month', 'Amount', 'Paid', 'Due Date', 'Status'].map((heading) => <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#667085]">No invoices available.</td></tr>
                ) : invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{invoice.invoice_number}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatBillingMonth(invoice.billing_month)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(invoice.amount)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(invoice.amount_paid)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{invoice.due_date}</td>
                    <td className="px-4 py-4"><span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: INVOICE_STATUS_COLORS[invoice.status as keyof typeof INVOICE_STATUS_COLORS] }}>{invoice.status.replace('_', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-lg border border-[#E3E7EE] bg-white shadow-sm">
          <div className="border-b border-[#E3E7EE] p-4"><h3 className="text-lg font-bold text-[#172033]">Payment History & Receipts</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Receipt', 'Type', 'Date', 'Amount', 'Reference', 'Action'].map((heading) => <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {collections.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#667085]">No payments recorded yet.</td></tr>
                ) : collections.map((collection) => (
                  <tr key={collection.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{collection.receipt_number}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.collection_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.collection_date}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(collection.amount_collected)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.transaction_reference || '-'}</td>
                    <td className="px-4 py-4"><button onClick={() => downloadReceiptPdf({ receiptNumber: collection.receipt_number, receiptDate: collection.collection_date, companyName: company?.business_name || company?.email || 'Company', collectionType: collection.collection_type.replace(/_/g, ' '), invoiceNumber: collection.incubation_fee_invoices?.invoice_number || null, billingMonth: collection.incubation_fee_invoices?.billing_month ? formatBillingMonth(collection.incubation_fee_invoices.billing_month) : null, depositReference: collection.deposit_id, amountPaid: collection.amount_collected, paymentMode: collection.payment_mode.replace(/_/g, ' '), transactionReference: collection.transaction_reference || null, receivedBy: collection.collected_by || null })} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2AA0D3] px-3 py-1.5 text-xs font-semibold text-white"><Download className="size-3.5" />Receipt</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
    </CompanyShell>
  );
}
