'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import {
  COLLECTION_TYPE_OPTIONS,
  CollectionType,
  computeInvoiceStatus,
  downloadReceiptPdf,
  FeeSettingRecord,
  formatBillingMonth,
  formatCurrency,
  InvoiceRecord,
  PAYMENT_MODE_OPTIONS,
  PaymentMode,
} from '@/lib/fee-management';
type Company = { id: string; business_name: string | null; email: string; };

type InvoiceWithCompany = InvoiceRecord & { applications?: { business_name: string | null; email: string } | null };

type DepositRow = {
  id: string;
  company_id: string;
  deposit_amount: number;
  amount_collected: number;
  amount_refunded: number;
  balance_amount: number;
  status: string;
};

export default function RecordPaymentPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithCompany[]>([]);
  const [settings, setSettings] = useState<FeeSettingRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [latestReceipt, setLatestReceipt] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    companyId: '',
    collectionType: 'monthly_fee' as CollectionType,
    invoiceId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    amountPaid: '',
    paymentMode: 'bank_transfer' as PaymentMode,
    transactionReference: '',
    remarks: '',
  });

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');

      await fetch('/api/admin/fee-management/sync-invoices', {
        method: 'POST',
        headers: await getAuthHeaders(),
      });

      const response = await fetch('/api/admin/fee-management/payments-data', {
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to load payment page');

      setCompanies(payload.companies || []);
      setInvoices(payload.invoices || []);
      setSettings(payload.settings || []);
      setDeposits(payload.deposits || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment page');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const settingsByCompany = useMemo(() => Object.fromEntries(settings.map((setting) => [setting.company_id, setting])), [settings]);
  const invoicesForCompany = invoices.filter((invoice) => invoice.company_id === form.companyId);

  const handleSubmit = async () => {
    if (!form.companyId || !form.amountPaid) {
      setError('Select company and enter amount paid.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const amount = Number(form.amountPaid || 0);
      if (Number.isNaN(amount) || amount <= 0) {
        throw new Error('Amount paid must be greater than zero.');
      }

      const response = await fetch('/api/admin/fee-management/payments-data', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: form.companyId,
          collectionType: form.collectionType,
          invoiceId: form.collectionType === 'monthly_fee' ? form.invoiceId : null,
          paymentDate: form.paymentDate,
          amountPaid: amount,
          paymentMode: form.paymentMode,
          transactionReference: form.transactionReference || null,
          remarks: form.remarks || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to record payment');

      const receipt = payload.receipt;
      const receiptDetails = {
        receiptNumber: receipt.receiptNumber,
        receiptDate: receipt.receiptDate,
        companyName: receipt.companyName,
        collectionType: COLLECTION_TYPE_OPTIONS.find((item) => item.value === form.collectionType)?.label || form.collectionType,
        invoiceNumber: receipt.invoiceNumber,
        billingMonth: receipt.billingMonth ? formatBillingMonth(receipt.billingMonth) : null,
        amountPaid: receipt.amountPaid,
        paymentMode: PAYMENT_MODE_OPTIONS.find((item) => item.value === form.paymentMode)?.label || form.paymentMode,
        transactionReference: receipt.transactionReference,
        receivedBy: receipt.receivedBy,
      };

      setLatestReceipt(receiptDetails);
      setNotice('Payment recorded successfully. Receipt is ready to download.');
      await loadData();
      setForm((prev) => ({ ...prev, amountPaid: '', transactionReference: '', remarks: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!latestReceipt) return;
    // Cast to the expected type for downloadReceiptPdf
    type ReceiptDetails = Parameters<typeof downloadReceiptPdf>[0];
    const receipt = latestReceipt as unknown as ReceiptDetails;
    try {
      const img = new Image();
      img.src = '/assets/SIIF Logo.png';
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 100;
      canvas.height = img.naturalHeight || 100;
      const ctx = canvas.getContext('2d');
      if (ctx && img.naturalWidth) ctx.drawImage(img, 0, 0);
      const logoDataUrl = img.naturalWidth ? canvas.toDataURL('image/png') : undefined;
      downloadReceiptPdf({ ...receipt, logoDataUrl });
    } catch {
      downloadReceiptPdf(receipt);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell
      title="Record Payment"
      subtitle="Capture monthly fee payments and instantly generate a receipt"
      userEmail={userEmail}
      onLogout={handleLogout}
    >
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-6 rounded-lg bg-[#EAF9F0] p-4 text-sm text-[#1E7F46]">{notice}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 border-0 shadow p-6">
          <h3 className="mb-4 text-xl font-bold" style={{ color: '#FF3B3B' }}>Payment Entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Company</label>
              <select value={form.companyId} onChange={(e) => setForm((prev) => ({ ...prev, companyId: e.target.value, invoiceId: '' }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                <option value="">Select company</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.business_name || company.email}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Collection Type</label>
              <select value={form.collectionType} onChange={(e) => setForm((prev) => ({ ...prev, collectionType: e.target.value as CollectionType }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                {COLLECTION_TYPE_OPTIONS.filter((item) => item.value !== 'deposit_refund' && item.value !== 'refundable_deposit').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            {form.collectionType === 'monthly_fee' && (
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Invoice</label>
                <select value={form.invoiceId} onChange={(e) => setForm((prev) => ({ ...prev, invoiceId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                  <option value="">Select invoice</option>
                  {invoicesForCompany.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} | {formatBillingMonth(invoice.billing_month)} | Due {invoice.due_date} | Balance {formatCurrency(Number(invoice.amount) - Number(invoice.amount_paid))}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Payment Date</label>
              <input type="date" value={form.paymentDate} onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Amount Paid</label>
              <input type="number" value={form.amountPaid} onChange={(e) => setForm((prev) => ({ ...prev, amountPaid: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Payment Mode</label>
              <select value={form.paymentMode} onChange={(e) => setForm((prev) => ({ ...prev, paymentMode: e.target.value as PaymentMode }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                {PAYMENT_MODE_OPTIONS.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Transaction Reference</label>
              <input value={form.transactionReference} onChange={(e) => setForm((prev) => ({ ...prev, transactionReference: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Remarks</label>
              <textarea value={form.remarks} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2" rows={4} />
            </div>
          </div>
          <button onClick={handleSubmit} disabled={saving} className="mt-4 rounded-lg bg-[#FF3B3B] px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving...' : 'Record Payment'}</button>
        </Card>

        <Card className="border-0 shadow p-6">
          <h3 className="mb-4 text-lg font-bold" style={{ color: '#FF3B3B' }}>Receipt</h3>
          {latestReceipt ? (
            <div className="space-y-3">
              {/* Receipt Header */}
              <div className="border-b border-gray-200 pb-3 mb-3">
                <p className="text-base font-bold" style={{ color: '#DC2626' }}>SJCET Innovation and Incubation Foundation</p>
                <p className="text-xs text-[#6B7280] mt-1">St.Joseph&apos;s College of Engineering &amp; Technology Palai,</p>
                <p className="text-xs text-[#6B7280]">Choondacherry PO, Meenachil Taluk,</p>
                <p className="text-xs text-[#6B7280]">Kottayam, Kerala, India, 686579</p>
              </div>
              {/* Receipt title centered */}
              <p className="text-center text-base font-bold text-[#1A1A1A] border-b border-gray-200 pb-3 mb-3">Receipt</p>
              {/* Receipt details */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Receipt No.</span>
                  <span className="font-medium text-[#4A4A4A] text-right text-xs">{String(latestReceipt.receiptNumber)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Company</span>
                  <span className="font-medium text-[#4A4A4A]">{String(latestReceipt.companyName)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Amount</span>
                  <span className="font-bold text-[#16A34A]">{formatCurrency(Number(latestReceipt.amountPaid || 0))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Mode</span>
                  <span className="font-medium text-[#4A4A4A]">{String(latestReceipt.paymentMode || '')}</span>
                </div>
              </div>
              <button onClick={handleDownloadReceipt} className="mt-2 w-full rounded-lg bg-[#2AA0D3] px-4 py-3 font-semibold text-white hover:bg-[#2289b5]">Download Receipt PDF</button>
            </div>
          ) : (
            <p className="text-sm text-[#8A8A8A]">Save a payment to generate a receipt preview.</p>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
