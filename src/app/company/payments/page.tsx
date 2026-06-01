'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import CompanyShell from '@/components/CompanyShell';
import { Download, IndianRupee, ReceiptText, ShieldCheck, WalletCards, type LucideIcon } from 'lucide-react';
import { DEPOSIT_STATUS_COLORS, downloadReceiptPdf, formatBillingMonth, formatCurrency, INVOICE_STATUS_COLORS } from '@/lib/fee-management';

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
