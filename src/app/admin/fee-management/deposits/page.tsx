'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { buildReceiptNumber, computeDepositStatus, DEPOSIT_STATUS_COLORS, downloadReceiptPdf, formatCurrency, PAYMENT_MODE_OPTIONS } from '@/lib/fee-management';

type Company = { id: string; business_name: string | null; email: string; };
type DepositRow = {
  id: string;
  company_id: string;
  deposit_amount: number;
  amount_collected: number;
  amount_refunded: number;
  balance_amount: number;
  collection_date: string | null;
  refund_date: string | null;
  status: 'pending' | 'collected' | 'partially_refunded' | 'refunded';
  remarks: string | null;
  applications?: { business_name: string | null; email: string };
};

const today = new Date().toISOString().slice(0, 10);

export default function RecordDepositPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [form, setForm] = useState({ companyId: '', action: 'collect', amount: '', collectionDate: today, paymentMode: 'bank_transfer', transactionReference: '', remarks: '' });

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');
      const [{ data: apps }, { data: depositRows }] = await Promise.all([
        supabase.from('applications').select('id, business_name, email').eq('status', 'approved').order('business_name', { ascending: true }),
        supabase.from('company_deposits').select('*, applications(business_name, email)').order('created_at', { ascending: false }),
      ]);
      setCompanies((apps || []) as Company[]);
      setDeposits((depositRows || []) as DepositRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deposit data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedDeposit = useMemo(() => deposits.find((deposit) => deposit.company_id === form.companyId), [deposits, form.companyId]);
  const selectedCompany = companies.find((company) => company.id === form.companyId);

  const handleSave = async () => {
    if (!selectedDeposit || !form.amount) {
      setError('Select a company with deposit settings and enter an amount.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const amount = Number(form.amount || 0);
      const amountCollected = form.action === 'collect' ? Number(selectedDeposit.amount_collected || 0) + amount : Number(selectedDeposit.amount_collected || 0);
      const amountRefunded = form.action === 'refund' ? Number(selectedDeposit.amount_refunded || 0) + amount : Number(selectedDeposit.amount_refunded || 0);
      const status = computeDepositStatus({ depositAmount: Number(selectedDeposit.deposit_amount || 0), amountCollected, amountRefunded });

      const { error: depositError } = await supabase
        .from('company_deposits')
        .update({
          amount_collected: amountCollected,
          amount_refunded: amountRefunded,
          balance_amount: Math.max(Number(selectedDeposit.deposit_amount || 0) - amountCollected + amountRefunded, 0),
          collection_date: form.action === 'collect' ? form.collectionDate : selectedDeposit.collection_date,
          refund_date: form.action === 'refund' ? form.collectionDate : selectedDeposit.refund_date,
          status,
          remarks: form.remarks || selectedDeposit.remarks,
        })
        .eq('id', selectedDeposit.id);
      if (depositError) throw depositError;

      const receiptNumber = buildReceiptNumber();
      const collectionType = form.action === 'collect' ? 'refundable_deposit' : 'deposit_refund';
      const { error: collectionError } = await supabase.from('fee_collections').insert({
        company_id: form.companyId,
        receipt_number: receiptNumber,
        collection_type: collectionType,
        deposit_id: selectedDeposit.id,
        collection_date: form.collectionDate,
        amount_collected: amount,
        payment_mode: form.paymentMode,
        transaction_reference: form.transactionReference || null,
        collected_by: userEmail,
        remarks: form.remarks || null,
        status: 'recorded',
      });
      if (collectionError) throw collectionError;

      downloadReceiptPdf({
        receiptNumber,
        receiptDate: form.collectionDate,
        companyName: selectedCompany?.business_name || selectedCompany?.email || 'Company',
        collectionType: form.action === 'collect' ? 'Refundable Deposit' : 'Deposit Refund',
        depositReference: selectedDeposit.id,
        amountPaid: amount,
        paymentMode: PAYMENT_MODE_OPTIONS.find((mode) => mode.value === form.paymentMode)?.label || form.paymentMode,
        transactionReference: form.transactionReference || null,
        receivedBy: userEmail,
      });

      setNotice('Deposit transaction recorded successfully.');
      setForm({ ...form, amount: '', transactionReference: '', remarks: '' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record deposit transaction');
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
    <AdminShell title="Record Deposit" subtitle="Manage refundable deposit collections and refunds" userEmail={userEmail} onLogout={handleLogout}>
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-6 rounded-lg bg-[#EAF9F0] p-4 text-sm text-[#1E7F46]">{notice}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-1 border-0 shadow p-6">
          <h3 className="mb-4 text-lg font-bold" style={{ color: '#FF3B3B' }}>Deposit Action</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Company</label>
              <select value={form.companyId} onChange={(e) => setForm((prev) => ({ ...prev, companyId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                <option value="">Select company</option>
                {deposits.map((deposit) => {
                  const company = companies.find((item) => item.id === deposit.company_id);
                  return <option key={deposit.id} value={deposit.company_id}>{company?.business_name || company?.email}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Action</label>
              <select value={form.action} onChange={(e) => setForm((prev) => ({ ...prev, action: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                <option value="collect">Collect Deposit</option>
                <option value="refund">Refund Deposit</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Amount</label>
              <input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date</label>
              <input type="date" value={form.collectionDate} onChange={(e) => setForm((prev) => ({ ...prev, collectionDate: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Payment Mode</label>
              <select value={form.paymentMode} onChange={(e) => setForm((prev) => ({ ...prev, paymentMode: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                {PAYMENT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <input type="text" value={form.transactionReference} onChange={(e) => setForm((prev) => ({ ...prev, transactionReference: e.target.value }))} placeholder="Transaction reference" className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            <textarea value={form.remarks} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2" rows={4} placeholder="Remarks" />
            <button onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-[#FF3B3B] px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Deposit Entry'}</button>
          </div>
        </Card>

        <Card className="xl:col-span-2 border-0 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Company', 'Configured Deposit', 'Collected', 'Refunded', 'Balance', 'Status'].map((heading) => <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {deposits.map((deposit) => (
                  <tr key={deposit.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{deposit.applications?.business_name || deposit.applications?.email || '-'}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(deposit.deposit_amount)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(deposit.amount_collected)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(deposit.amount_refunded)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(deposit.balance_amount)}</td>
                    <td className="px-4 py-4"><span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: DEPOSIT_STATUS_COLORS[deposit.status] }}>{deposit.status.replace('_', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
