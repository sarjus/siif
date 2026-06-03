'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { DEPOSIT_STATUS_COLORS, downloadReceiptPdf, formatCurrency, PAYMENT_MODE_OPTIONS } from '@/lib/fee-management';

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
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');

      const response = await fetch('/api/admin/fee-management/deposits', {
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to load deposits');

      setCompanies(payload.companies || []);
      setDeposits(payload.deposits || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deposit data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedDeposit = useMemo(() => deposits.find((d) => d.company_id === form.companyId), [deposits, form.companyId]);
  const selectedCompany = companies.find((c) => c.id === form.companyId);

  const handleSave = async () => {
    if (!selectedDeposit || !form.amount) {
      setError('Select a company with deposit settings and enter an amount.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/fee-management/deposits', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: form.companyId,
          depositId: selectedDeposit.id,
          action: form.action,
          amount: form.amount,
          collectionDate: form.collectionDate,
          paymentMode: form.paymentMode,
          transactionReference: form.transactionReference || null,
          remarks: form.remarks || null,
          existingDeposit: {
            deposit_amount: selectedDeposit.deposit_amount,
            amount_collected: selectedDeposit.amount_collected,
            amount_refunded: selectedDeposit.amount_refunded,
            collection_date: selectedDeposit.collection_date,
            refund_date: selectedDeposit.refund_date,
            remarks: selectedDeposit.remarks,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to record deposit');

      // Auto-download receipt
      downloadReceiptPdf({
        receiptNumber: payload.receipt.receiptNumber,
        receiptDate: payload.receipt.receiptDate,
        companyName: payload.receipt.companyName,
        collectionType: payload.receipt.collectionType,
        depositReference: payload.receipt.depositReference,
        amountPaid: payload.receipt.amountPaid,
        paymentMode: PAYMENT_MODE_OPTIONS.find((m) => m.value === payload.receipt.paymentMode)?.label || payload.receipt.paymentMode,
        transactionReference: payload.receipt.transactionReference,
        receivedBy: payload.receipt.receivedBy,
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

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

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
                  const company = companies.find((c) => c.id === deposit.company_id);
                  return <option key={deposit.id} value={deposit.company_id}>{company?.business_name || company?.email}</option>;
                })}
              </select>
            </div>
            {selectedDeposit && (
              <div className="rounded-lg border border-[#E3E7EE] bg-[#F8FAFC] p-3 text-sm space-y-1">
                <p><span className="font-medium">Configured Deposit:</span> {formatCurrency(selectedDeposit.deposit_amount)}</p>
                <p><span className="font-medium">Collected:</span> {formatCurrency(selectedDeposit.amount_collected)}</p>
                <p><span className="font-medium">Balance:</span> {formatCurrency(selectedDeposit.balance_amount)}</p>
                <p><span className="font-medium">Status:</span> <span className="font-semibold">{selectedDeposit.status.replace('_', ' ')}</span></p>
              </div>
            )}
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
                {PAYMENT_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <input type="text" value={form.transactionReference} onChange={(e) => setForm((prev) => ({ ...prev, transactionReference: e.target.value }))} placeholder="Transaction reference" className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            <textarea value={form.remarks} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2" rows={4} placeholder="Remarks" />
            <button onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-[#FF3B3B] px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Deposit Entry'}
            </button>
          </div>
        </Card>

        <Card className="xl:col-span-2 border-0 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Company', 'Configured Deposit', 'Collected', 'Refunded', 'Balance', 'Status'].map((h) => <th key={h} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {deposits.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No deposit records found.</td></tr>
                ) : deposits.map((deposit) => (
                  <tr key={deposit.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{deposit.applications?.business_name || deposit.applications?.email || '-'}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(deposit.deposit_amount)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(deposit.amount_collected)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(deposit.amount_refunded)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(deposit.balance_amount)}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: DEPOSIT_STATUS_COLORS[deposit.status] }}>
                        {deposit.status.replace('_', ' ')}
                      </span>
                    </td>
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
