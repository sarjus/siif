'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import {
  buildReceiptNumber,
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

      await fetch('/api/admin/fee-management/sync-invoices', { method: 'POST' });

      const [companiesRes, invoicesRes, settingsRes, depositsRes] = await Promise.all([
        supabase.from('applications').select('id, business_name, email').eq('status', 'approved').order('business_name', { ascending: true }),
        supabase.from('incubation_fee_invoices').select('*, applications(business_name, email)').in('status', ['pending', 'partially_paid', 'overdue']).order('due_date', { ascending: true }),
        supabase.from('incubation_fee_settings').select('*'),
        supabase.from('company_deposits').select('*'),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (depositsRes.error) throw depositsRes.error;

      setCompanies((companiesRes.data || []) as Company[]);
      setInvoices((invoicesRes.data || []) as InvoiceWithCompany[]);
      setSettings((settingsRes.data || []) as FeeSettingRecord[]);
      setDeposits((depositsRes.data || []) as DepositRow[]);
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

      let invoiceNumber: string | null = null;
      let billingMonth: string | null = null;
      let invoiceId: string | null = null;

      if (form.collectionType === 'monthly_fee') {
        const invoice = invoices.find((item) => item.id === form.invoiceId);
        if (!invoice) {
          throw new Error('Select a valid invoice for monthly fee payment.');
        }
        const setting = settingsByCompany[form.companyId];
        invoiceId = invoice.id;
        invoiceNumber = invoice.invoice_number;
        billingMonth = formatBillingMonth(invoice.billing_month);
        const nextPaid = Number(invoice.amount_paid || 0) + amount;
        const nextStatus = computeInvoiceStatus({
          amount: Number(invoice.amount || 0),
          amountPaid: nextPaid,
          dueDate: invoice.due_date,
          gracePeriodDays: Number(setting?.grace_period_days || 0),
        });
        const { error: updateInvoiceError } = await supabase
          .from('incubation_fee_invoices')
          .update({ amount_paid: nextPaid, status: nextStatus })
          .eq('id', invoice.id);
        if (updateInvoiceError) throw updateInvoiceError;
      }

      const receiptNumber = buildReceiptNumber();
      const { error: insertError } = await supabase.from('fee_collections').insert({
        company_id: form.companyId,
        receipt_number: receiptNumber,
        collection_type: form.collectionType,
        invoice_id: invoiceId,
        deposit_id: null,
        collection_date: form.paymentDate,
        amount_collected: amount,
        payment_mode: form.paymentMode,
        transaction_reference: form.transactionReference || null,
        collected_by: userEmail || 'Admin',
        remarks: form.remarks || null,
        attachment_url: null,
        status: 'recorded',
      });
      if (insertError) throw insertError;

      const companyName = companies.find((company) => company.id === form.companyId)?.business_name || 'Company';
      const receiptDetails = {
        receiptNumber,
        receiptDate: form.paymentDate,
        companyName,
        collectionType: COLLECTION_TYPE_OPTIONS.find((item) => item.value === form.collectionType)?.label || form.collectionType,
        invoiceNumber,
        billingMonth,
        amountPaid: amount,
        paymentMode: PAYMENT_MODE_OPTIONS.find((item) => item.value === form.paymentMode)?.label || form.paymentMode,
        transactionReference: form.transactionReference,
        receivedBy: userEmail,
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
              <p className="text-sm text-[#4A4A4A]">Receipt Number: <strong>{String(latestReceipt.receiptNumber)}</strong></p>
              <p className="text-sm text-[#4A4A4A]">Company: {String(latestReceipt.companyName)}</p>
              <p className="text-sm text-[#4A4A4A]">Amount: {formatCurrency(Number(latestReceipt.amountPaid || 0))}</p>
              <button onClick={() => downloadReceiptPdf(latestReceipt as never)} className="w-full rounded-lg bg-[#2AA0D3] px-4 py-3 font-semibold text-white hover:bg-[#2289b5]">Download Receipt</button>
            </div>
          ) : (
            <p className="text-sm text-[#8A8A8A]">Save a payment to generate a receipt preview.</p>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
