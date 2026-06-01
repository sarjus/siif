'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { DEPOSIT_STATUS_COLORS, downloadReceiptPdf, formatBillingMonth, formatCurrency, INVOICE_STATUS_COLORS } from '@/lib/fee-management';

export default function CompanyPaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [setting, setSetting] = useState<any>(null);
  const [deposit, setDeposit] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

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
      setCompany(appData);

      await fetch('/api/admin/fee-management/sync-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: appData.id }) });

      const [{ data: settingData }, { data: depositData }, { data: invoiceData }, { data: collectionData }, { data: notificationData }] = await Promise.all([
        supabase.from('incubation_fee_settings').select('*').eq('company_id', appData.id).maybeSingle(),
        supabase.from('company_deposits').select('*').eq('company_id', appData.id).maybeSingle(),
        supabase.from('incubation_fee_invoices').select('*').eq('company_id', appData.id).order('billing_month', { ascending: false }),
        supabase.from('fee_collections').select('*, incubation_fee_invoices(invoice_number, billing_month)').eq('company_id', appData.id).order('collection_date', { ascending: false }),
        supabase.from('notifications').select('*').or(`company_id.eq.${appData.id},recipient_type.eq.all`).order('sent_at', { ascending: false }),
      ]);

      setSetting(settingData);
      setDeposit(depositData);
      setInvoices(invoiceData || []);
      setCollections(collectionData || []);
      setNotifications(notificationData || []);
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
    <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}>
      <div className="bg-[#0F172A] p-6 border-b border-slate-700">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Payment History</h1>
            <p style={{ color: '#CBD5E1', fontSize: '14px', marginTop: '4px' }}>
              Fee configuration, outstanding dues, deposit status, and receipts
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/company/dashboard" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white">Back to Dashboard</a>
            <button onClick={handleLogout} className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white">Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
        {notices.map((notice, index) => <div key={`${notice.message}-${index}`} className="mb-4 rounded-lg p-4 text-sm text-white" style={{ backgroundColor: notice.color }}>{notice.message}</div>)}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {(
            [
              ['Outstanding Dues', formatCurrency(invoices.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + Math.max(Number(item.amount || 0) - Number(item.amount_paid || 0), 0), 0)), '#DC2626'],
              ['Monthly Fee', formatCurrency(setting?.monthly_fee || 0), '#FF3B3B'],
              ...(Number(deposit?.deposit_amount || 0) > 0 ? [['Deposit Balance', formatCurrency(deposit?.balance_amount || 0), '#2AA0D3'] as [string, string, string]] : []),
              ['Total Paid', formatCurrency(collections.reduce((sum, item) => sum + Number(item.amount_collected || 0), 0)), '#16A34A'],
            ] as Array<[string, string, string]>
          ).map(([label, value, color]) => <Card key={String(label)} className="border-0 shadow p-5"><p className="mb-1 text-xs font-semibold uppercase text-[#8A8A8A]">{label}</p><p className="text-2xl font-bold" style={{ color: String(color) }}>{value}</p></Card>)}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <Card className="border-0 shadow p-6">
            <h3 className="mb-4 text-lg font-bold" style={{ color: '#FF3B3B' }}>Fee Configuration Details</h3>
            <div className="space-y-2 text-sm text-[#4A4A4A]">
              <p><strong>Company:</strong> {company?.business_name || '-'}</p>
              <p><strong>Lead Entrepreneur:</strong> {company?.lead_name || '-'}</p>
              <p><strong>Monthly Fee:</strong> {formatCurrency(setting?.monthly_fee || 0)}</p>
              <p><strong>Start Date:</strong> {setting?.start_date || '-'}</p>
              <p><strong>Due Day:</strong> {setting?.due_day || '-'}</p>
              <p><strong>Status:</strong> {setting?.status || '-'}</p>
            </div>
          </Card>
          {Number(deposit?.deposit_amount || 0) > 0 && (
            <Card className="border-0 shadow p-6">
              <h3 className="mb-4 text-lg font-bold" style={{ color: '#FF3B3B' }}>Refundable Deposit Details</h3>
              <div className="space-y-2 text-sm text-[#4A4A4A]">
                <p><strong>Configured Deposit:</strong> {formatCurrency(deposit?.deposit_amount || 0)}</p>
                <p><strong>Collected:</strong> {formatCurrency(deposit?.amount_collected || 0)}</p>
                <p><strong>Refunded:</strong> {formatCurrency(deposit?.amount_refunded || 0)}</p>
                <p><strong>Balance:</strong> {formatCurrency(deposit?.balance_amount || 0)}</p>
                {deposit?.status && <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: DEPOSIT_STATUS_COLORS[deposit.status] }}>{deposit.status.replace('_', ' ')}</span>}
              </div>
            </Card>
          )}
          <Card className="border-0 shadow p-6">
            <h3 className="mb-4 text-lg font-bold" style={{ color: '#FF3B3B' }}>Notification History</h3>
            <div className="space-y-3 max-h-[240px] overflow-y-auto">
              {notifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-[#4A4A4A]">{notification.title}</p>
                  <p className="mt-1 text-xs text-[#666666]">{notification.message}</p>
                  <p className="mt-2 text-[11px] text-[#8A8A8A]">{new Date(notification.sent_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="border-0 shadow overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200"><h3 className="text-lg font-bold" style={{ color: '#FF3B3B' }}>Outstanding Dues & Invoices</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Invoice', 'Billing Month', 'Amount', 'Paid', 'Due Date', 'Status'].map((heading) => <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{invoice.invoice_number}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatBillingMonth(invoice.billing_month)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(invoice.amount)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(invoice.amount_paid)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{invoice.due_date}</td>
                    <td className="px-4 py-4"><span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: INVOICE_STATUS_COLORS[invoice.status] }}>{invoice.status.replace('_', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="border-0 shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200"><h3 className="text-lg font-bold" style={{ color: '#FF3B3B' }}>Payment History & Receipts</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Receipt', 'Type', 'Date', 'Amount', 'Reference', 'Action'].map((heading) => <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => (
                  <tr key={collection.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{collection.receipt_number}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.collection_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.collection_date}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(collection.amount_collected)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.transaction_reference || '-'}</td>
                    <td className="px-4 py-4"><button onClick={() => downloadReceiptPdf({ receiptNumber: collection.receipt_number, receiptDate: collection.collection_date, companyName: company?.business_name || company?.email || 'Company', collectionType: collection.collection_type.replace(/_/g, ' '), invoiceNumber: collection.incubation_fee_invoices?.invoice_number || null, billingMonth: collection.incubation_fee_invoices?.billing_month ? formatBillingMonth(collection.incubation_fee_invoices.billing_month) : null, depositReference: collection.deposit_id, amountPaid: collection.amount_collected, paymentMode: collection.payment_mode.replace(/_/g, ' '), transactionReference: collection.transaction_reference || null, receivedBy: collection.collected_by || null })} className="rounded-lg bg-[#2AA0D3] px-3 py-1 text-xs font-semibold text-white">Download Receipt</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
