'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReceiptPdf, exportCsv, formatBillingMonth, formatCurrency, PAYMENT_MODE_OPTIONS } from '@/lib/fee-management';
import { downloadPaymentSlipPdf, type PaymentSlipDetails } from '@/lib/staff-payment-pdf';
import { loadLogoForPdf } from '@/lib/pdf-logo';

type TransactionRow = {
  id: string;
  receipt_number: string;
  company_id: string;
  collection_type: string;
  invoice_id: string | null;
  deposit_id: string | null;
  collection_date: string;
  amount_collected: number;
  payment_mode: string;
  transaction_reference: string | null;
  collected_by: string | null;
  remarks: string | null;
  status: 'recorded' | 'cancelled';
  applications?: { business_name: string | null; email: string };
  incubation_fee_invoices?: { invoice_number: string; billing_month: string; amount: number; due_date: string; company_id: string };
};

type StaffPayment = {
  id: string;
  payment_number: string;
  payment_type: string;
  payment_month: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  transaction_reference: string | null;
  paid_by: string | null;
  remarks: string | null;
  siif_staff?: { name: string; designation: string } | null;
};

export default function TransactionsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [staffPayments, setStaffPayments] = useState<StaffPayment[]>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; business_name: string | null }>>([]);
  const [activeTab, setActiveTab] = useState<'receipts' | 'payments'>('receipts');
  const [filters, setFilters] = useState({ companyId: 'all', mode: 'all', type: 'all', from: '', to: '' });
  const [paySearch, setPaySearch] = useState('');
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [editForm, setEditForm] = useState({ collection_date: '', payment_mode: 'bank_transfer', transaction_reference: '', remarks: '' });

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');

      const headers = await getAuthHeaders();
      const [txRes, payRes] = await Promise.all([
        fetch('/api/admin/fee-management/transactions', { headers }),
        fetch('/api/admin/staff/payments', { headers }),
      ]);

      const txPayload = await txRes.json();
      const payPayload = await payRes.json();

      if (!txRes.ok) throw new Error(txPayload?.error || 'Failed to load transactions');

      setTransactions(txPayload.transactions || []);
      setCompanies(txPayload.companies || []);
      if (payRes.ok) setStaffPayments(payPayload.payments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => transactions.filter((t) => {
    if (filters.companyId !== 'all' && t.company_id !== filters.companyId) return false;
    if (filters.mode !== 'all' && t.payment_mode !== filters.mode) return false;
    if (filters.type !== 'all' && t.collection_type !== filters.type) return false;
    if (filters.from && t.collection_date < filters.from) return false;
    if (filters.to && t.collection_date > filters.to) return false;
    return true;
  }), [filters, transactions]);

  const filteredPayments = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    if (!q) return staffPayments;
    return staffPayments.filter((p) =>
      p.payment_number.toLowerCase().includes(q) ||
      (p.siif_staff?.name || '').toLowerCase().includes(q) ||
      p.payment_type.toLowerCase().includes(q)
    );
  }, [staffPayments, paySearch]);

  const handleDelete = async (transaction: TransactionRow) => {
    if (!confirm('Delete this transaction? This will recalculate linked balances.')) return;
    setError(null);
    try {
      const response = await fetch('/api/admin/fee-management/transactions', {
        method: 'DELETE',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: transaction.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to delete');
      setNotice('Transaction deleted successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction');
    }
  };

  const startEdit = (transaction: TransactionRow) => {
    setEditing(transaction);
    setEditForm({ collection_date: transaction.collection_date, payment_mode: transaction.payment_mode, transaction_reference: transaction.transaction_reference || '', remarks: transaction.remarks || '' });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const response = await fetch('/api/admin/fee-management/transactions', {
        method: 'PUT',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: editing.id, updates: editForm }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to update');
      setNotice('Transaction updated successfully.');
      setEditing(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction');
    }
  };

  const exportTransactions = () => {
    exportCsv('fee-transactions.csv',
      ['Receipt Number', 'Company', 'Collection Type', 'Billing Month', 'Amount', 'Payment Date', 'Payment Mode', 'Transaction Reference', 'Status'],
      filtered.map((item) => [item.receipt_number, item.applications?.business_name || item.applications?.email || '-', item.collection_type, item.incubation_fee_invoices?.billing_month ? formatBillingMonth(item.incubation_fee_invoices.billing_month) : '-', item.amount_collected, item.collection_date, item.payment_mode, item.transaction_reference || '-', item.status])
    );
  };

  const exportStaffPayments = () => {
    exportCsv('staff-payments.csv',
      ['Payment Number', 'Staff Name', 'Designation', 'Type', 'Month', 'Amount', 'Payment Date', 'Payment Mode', 'Reference'],
      filteredPayments.map((p) => [p.payment_number, p.siif_staff?.name || '-', p.siif_staff?.designation || '-', p.payment_type, p.payment_month, p.amount, p.payment_date, p.payment_mode, p.transaction_reference || '-'])
    );
  };

  const handleDownloadSlip = async (p: StaffPayment) => {
    const logoDataUrl = await loadLogoForPdf();

    const slip: PaymentSlipDetails = {
      paymentNumber: p.payment_number,
      paymentDate: p.payment_date,
      paymentMonth: p.payment_month,
      staffName: p.siif_staff?.name || '',
      designation: p.siif_staff?.designation || '',
      paymentType: p.payment_type as 'salary' | 'honorarium',
      amount: p.amount,
      paymentMode: p.payment_mode,
      transactionReference: p.transaction_reference,
      paidBy: p.paid_by,
      remarks: p.remarks,
      logoDataUrl,
    };
    downloadPaymentSlipPdf(slip);
  };

  const monthLabel = (paymentMonth: string) => {
    const [year, month] = paymentMonth.slice(0, 7).split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const totalStaffPaid = staffPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <AdminShell
      title="Transactions"
      subtitle="Complete income and expenditure history for SIIF"
      userEmail={userEmail}
      onLogout={handleLogout}
      headerActions={
        activeTab === 'receipts'
          ? <button onClick={exportTransactions} className="rounded-lg bg-[#2AA0D3] px-4 py-2 text-white font-semibold text-sm">Export CSV</button>
          : <button onClick={exportStaffPayments} className="rounded-lg bg-[#2AA0D3] px-4 py-2 text-white font-semibold text-sm">Export CSV</button>
      }
    >
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-6 rounded-lg bg-[#EAF9F0] p-4 text-sm text-[#1E7F46]">{notice}</div>}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-[#E3E7EE]">
        <button
          onClick={() => setActiveTab('receipts')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'receipts' ? 'border-[#FF3B3B] text-[#FF3B3B]' : 'border-transparent text-[#667085] hover:text-[#344054]'}`}
        >
          Fee Receipts (Income)
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'payments' ? 'border-[#FF3B3B] text-[#FF3B3B]' : 'border-transparent text-[#667085] hover:text-[#344054]'}`}
        >
          Staff Payments (Expenditure)
        </button>
      </div>

      {/* ── FEE RECEIPTS TAB ── */}
      {activeTab === 'receipts' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <select value={filters.companyId} onChange={(e) => setFilters((prev) => ({ ...prev, companyId: e.target.value }))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm"><option value="all">All Companies</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.business_name || 'Company'}</option>)}</select>
            <select value={filters.mode} onChange={(e) => setFilters((prev) => ({ ...prev, mode: e.target.value }))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm"><option value="all">All Payment Modes</option>{PAYMENT_MODE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
            <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm"><option value="all">All Types</option>{['monthly_fee','refundable_deposit','additional_charges','penalty_charges','other_fees','deposit_refund'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
            <input type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm" />
            <input type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {[
              ['Total Fees Collected', formatCurrency(filtered.filter((i) => i.collection_type === 'monthly_fee').reduce((s, i) => s + Number(i.amount_collected || 0), 0)), '#16A34A'],
              ['Total Deposits Collected', formatCurrency(filtered.filter((i) => i.collection_type === 'refundable_deposit').reduce((s, i) => s + Number(i.amount_collected || 0), 0)), '#2AA0D3'],
              ['Pending Amount', formatCurrency(filtered.filter((i) => i.incubation_fee_invoices && i.incubation_fee_invoices.amount > i.amount_collected).reduce((s, i) => s + Math.max((i.incubation_fee_invoices?.amount || 0) - i.amount_collected, 0), 0)), '#F59E0B'],
              ['Overdue (Unpaid Past Due)', formatCurrency(
                (() => {
                  // Get unique overdue invoices from fee_collections that are past due and not fully paid
                  const seen = new Set<string>();
                  let total = 0;
                  filtered.forEach((t) => {
                    const inv = t.incubation_fee_invoices;
                    if (!inv || seen.has(t.invoice_id || '')) return;
                    if (t.invoice_id && new Date(inv.due_date) < new Date()) {
                      const outstanding = Math.max(Number(inv.amount || 0) - Number(t.amount_collected || 0), 0);
                      if (outstanding > 0) {
                        total += outstanding;
                        seen.add(t.invoice_id);
                      }
                    }
                  });
                  return total;
                })()
              ), '#DC2626'],
              ['Paid Companies', String(new Set(filtered.filter((i) => i.collection_type === 'monthly_fee').map((i) => i.company_id)).size), '#7C3AED'],
              ['Overdue Companies', String(new Set(filtered.filter((i) => i.incubation_fee_invoices && new Date(i.incubation_fee_invoices.due_date) < new Date() && Math.max(Number(i.incubation_fee_invoices.amount || 0) - Number(i.amount_collected || 0), 0) > 0).map((i) => i.company_id)).size), '#0EA5A0'],
            ].map(([label, value, color]) => (
              <Card key={String(label)} className="border-0 shadow p-5">
                <p className="mb-1 text-xs font-semibold uppercase text-[#8A8A8A]">{label}</p>
                <p className="text-xl font-bold" style={{ color: String(color) }}>{value}</p>
              </Card>
            ))}
          </div>

          <Card className="border-0 shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F5F6F7' }}>
                    {['Receipt Number', 'Company', 'Collection Type', 'Billing Month', 'Amount', 'Payment Date', 'Payment Mode', 'Transaction Reference', 'Status', 'Actions'].map((h) => <th key={h} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No transactions found.</td></tr>
                  ) : filtered.map((t) => (
                    <tr key={t.id} className="border-t border-gray-200">
                      <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{t.receipt_number}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{t.applications?.business_name || t.applications?.email || '-'}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A] capitalize">{t.collection_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{t.incubation_fee_invoices?.billing_month ? formatBillingMonth(t.incubation_fee_invoices.billing_month) : '-'}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(t.amount_collected)}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{t.collection_date}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A] capitalize">{t.payment_mode.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{t.transaction_reference || '-'}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{t.status}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => downloadReceiptPdf({ receiptNumber: t.receipt_number, receiptDate: t.collection_date, companyName: t.applications?.business_name || t.applications?.email || 'Company', collectionType: t.collection_type.replace(/_/g, ' '), invoiceNumber: t.incubation_fee_invoices?.invoice_number || null, billingMonth: t.incubation_fee_invoices?.billing_month ? formatBillingMonth(t.incubation_fee_invoices.billing_month) : null, depositReference: t.deposit_id, amountPaid: t.amount_collected, paymentMode: t.payment_mode.replace(/_/g, ' '), transactionReference: t.transaction_reference || null, receivedBy: t.collected_by || null })} className="rounded-lg bg-[#2AA0D3] px-3 py-1 text-xs font-semibold text-white">Receipt</button>
                          <button onClick={() => startEdit(t)} className="rounded-lg border border-[#FF3B3B] px-3 py-1 text-xs font-semibold text-[#FF3B3B]">Edit</button>
                          <button onClick={() => handleDelete(t)} className="rounded-lg border border-[#D32F2F] px-3 py-1 text-xs font-semibold text-[#D32F2F]">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── STAFF PAYMENTS TAB ── */}
      {activeTab === 'payments' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-0 shadow p-5">
              <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">Total Staff Payments</p>
              <p className="text-2xl font-bold text-[#FF3B3B]">{formatCurrency(totalStaffPaid)}</p>
            </Card>
            <Card className="border-0 shadow p-5">
              <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">No. of Payments</p>
              <p className="text-2xl font-bold text-[#344054]">{staffPayments.length}</p>
            </Card>
            <Card className="border-0 shadow p-5">
              <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">Honorarium Paid</p>
              <p className="text-2xl font-bold text-[#2AA0D3]">{formatCurrency(staffPayments.filter((p) => p.payment_type === 'honorarium').reduce((s, p) => s + Number(p.amount || 0), 0))}</p>
            </Card>
          </div>

          <Card className="mb-4 border-0 shadow p-4">
            <input
              value={paySearch}
              onChange={(e) => setPaySearch(e.target.value)}
              placeholder="Search payment number, staff name, or type..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
            />
          </Card>

          <Card className="border-0 shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F5F6F7' }}>
                    {['Payment No.', 'Staff', 'Type', 'Month', 'Amount', 'Payment Date', 'Mode', 'Reference', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No staff payments recorded yet.</td></tr>
                  ) : filteredPayments.map((p) => (
                    <tr key={p.id} className="border-t border-gray-200">
                      <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{p.payment_number}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">
                        <div className="font-semibold">{p.siif_staff?.name || '-'}</div>
                        <div className="text-xs text-[#8A8A8A]">{p.siif_staff?.designation || ''}</div>
                      </td>
                      <td className="px-4 py-4 text-sm capitalize text-[#4A4A4A]">{p.payment_type}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{monthLabel(p.payment_month)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{p.payment_date}</td>
                      <td className="px-4 py-4 text-sm capitalize text-[#4A4A4A]">{p.payment_mode.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{p.transaction_reference || '-'}</td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleDownloadSlip(p)}
                          className="rounded-lg bg-[#2AA0D3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2289b5]"
                        >
                          Slip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold" style={{ color: '#FF3B3B' }}>Edit Transaction</h3>
            <div className="space-y-4">
              <input type="date" value={editForm.collection_date} onChange={(e) => setEditForm((prev) => ({ ...prev, collection_date: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
              <select value={editForm.payment_mode} onChange={(e) => setEditForm((prev) => ({ ...prev, payment_mode: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">{PAYMENT_MODE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
              <input type="text" value={editForm.transaction_reference} onChange={(e) => setEditForm((prev) => ({ ...prev, transaction_reference: e.target.value }))} placeholder="Transaction reference" className="w-full rounded-lg border border-gray-300 px-4 py-2" />
              <textarea value={editForm.remarks} onChange={(e) => setEditForm((prev) => ({ ...prev, remarks: e.target.value }))} rows={4} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
              <div className="flex gap-3">
                <button onClick={saveEdit} className="flex-1 rounded-lg bg-[#FF3B3B] px-4 py-3 font-semibold text-white">Save Changes</button>
                <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-semibold text-[#4A4A4A]">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
