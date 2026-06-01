'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { buildReceiptNumber, computeDepositStatus, computeInvoiceStatus, downloadReceiptPdf, exportCsv, formatBillingMonth, formatCurrency, PAYMENT_MODE_OPTIONS } from '@/lib/fee-management';

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

type DepositRow = { id: string; deposit_amount: number; amount_collected: number; amount_refunded: number; balance_amount: number; company_id: string; };

export default function TransactionsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; business_name: string | null }>>([]);
  const [filters, setFilters] = useState({ companyId: 'all', mode: 'all', type: 'all', from: '', to: '' });
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [editForm, setEditForm] = useState({ collection_date: '', payment_mode: 'bank_transfer', transaction_reference: '', remarks: '' });

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');

      const [{ data: transactionData }, { data: companyData }] = await Promise.all([
        supabase
          .from('fee_collections')
          .select('*, applications(business_name, email), incubation_fee_invoices(invoice_number, billing_month, amount, due_date, company_id)')
          .order('collection_date', { ascending: false }),
        supabase.from('applications').select('id, business_name').eq('status', 'approved').order('business_name', { ascending: true }),
      ]);

      setTransactions((transactionData || []) as TransactionRow[]);
      setCompanies(companyData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => transactions.filter((transaction) => {
    if (filters.companyId !== 'all' && transaction.company_id !== filters.companyId) return false;
    if (filters.mode !== 'all' && transaction.payment_mode !== filters.mode) return false;
    if (filters.type !== 'all' && transaction.collection_type !== filters.type) return false;
    if (filters.from && transaction.collection_date < filters.from) return false;
    if (filters.to && transaction.collection_date > filters.to) return false;
    return true;
  }), [filters, transactions]);

  const recalcInvoice = async (invoiceId: string, companyId: string) => {
    const [{ data: invoice }, { data: setting }, { data: collections }] = await Promise.all([
      supabase.from('incubation_fee_invoices').select('*').eq('id', invoiceId).single(),
      supabase.from('incubation_fee_settings').select('grace_period_days').eq('company_id', companyId).maybeSingle(),
      supabase.from('fee_collections').select('amount_collected').eq('invoice_id', invoiceId).eq('status', 'recorded'),
    ]);

    const totalPaid = (collections || []).reduce((sum, item) => sum + Number(item.amount_collected || 0), 0);
    const status = computeInvoiceStatus({ amount: Number(invoice?.amount || 0), amountPaid: totalPaid, dueDate: invoice?.due_date || new Date().toISOString().slice(0, 10), gracePeriodDays: Number(setting?.grace_period_days || 0) });
    await supabase.from('incubation_fee_invoices').update({ amount_paid: totalPaid, status }).eq('id', invoiceId);
  };

  const recalcDeposit = async (depositId: string) => {
    const [{ data: deposit }, { data: collections }] = await Promise.all([
      supabase.from('company_deposits').select('*').eq('id', depositId).single(),
      supabase.from('fee_collections').select('collection_type, amount_collected').eq('deposit_id', depositId).eq('status', 'recorded'),
    ]);

    const totalCollected = (collections || []).filter((item) => item.collection_type === 'refundable_deposit').reduce((sum, item) => sum + Number(item.amount_collected || 0), 0);
    const totalRefunded = (collections || []).filter((item) => item.collection_type === 'deposit_refund').reduce((sum, item) => sum + Number(item.amount_collected || 0), 0);
    const status = computeDepositStatus({ depositAmount: Number(deposit?.deposit_amount || 0), amountCollected: totalCollected, amountRefunded: totalRefunded });

    await supabase.from('company_deposits').update({ amount_collected: totalCollected, amount_refunded: totalRefunded, balance_amount: Math.max(Number(deposit?.deposit_amount || 0) - totalCollected + totalRefunded, 0), status }).eq('id', depositId);
  };

  const handleDelete = async (transaction: TransactionRow) => {
    const confirmed = confirm('Delete this transaction? This will recalculate linked balances.');
    if (!confirmed) return;
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('fee_collections').delete().eq('id', transaction.id);
      if (deleteError) throw deleteError;
      if (transaction.invoice_id) await recalcInvoice(transaction.invoice_id, transaction.company_id);
      if (transaction.deposit_id) await recalcDeposit(transaction.deposit_id);
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
      const { error: updateError } = await supabase.from('fee_collections').update(editForm).eq('id', editing.id);
      if (updateError) throw updateError;
      setNotice('Transaction updated successfully.');
      setEditing(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction');
    }
  };

  const exportTransactions = () => {
    exportCsv('fee-transactions.csv', ['Receipt Number', 'Company', 'Collection Type', 'Billing Month', 'Amount', 'Payment Date', 'Payment Mode', 'Transaction Reference', 'Status'], filtered.map((item) => [item.receipt_number, item.applications?.business_name || item.applications?.email || '-', item.collection_type, item.incubation_fee_invoices?.billing_month ? formatBillingMonth(item.incubation_fee_invoices.billing_month) : '-', item.amount_collected, item.collection_date, item.payment_mode, item.transaction_reference || '-', item.status]));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Transactions" subtitle="Complete fee and deposit collection history" userEmail={userEmail} onLogout={handleLogout} headerActions={<button onClick={exportTransactions} className="rounded-lg bg-[#2AA0D3] px-4 py-2 text-white font-semibold">Export CSV</button>}>
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-6 rounded-lg bg-[#EAF9F0] p-4 text-sm text-[#1E7F46]">{notice}</div>}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <select value={filters.companyId} onChange={(e) => setFilters((prev) => ({ ...prev, companyId: e.target.value }))} className="rounded-lg border border-gray-300 px-4 py-2"><option value="all">All Companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.business_name || 'Company'}</option>)}</select>
        <select value={filters.mode} onChange={(e) => setFilters((prev) => ({ ...prev, mode: e.target.value }))} className="rounded-lg border border-gray-300 px-4 py-2"><option value="all">All Payment Modes</option>{PAYMENT_MODE_OPTIONS.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select>
        <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))} className="rounded-lg border border-gray-300 px-4 py-2"><option value="all">All Collection Types</option>{['monthly_fee','refundable_deposit','additional_charges','penalty_charges','other_fees','deposit_refund'].map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}</select>
        <input type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} className="rounded-lg border border-gray-300 px-4 py-2" />
        <input type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} className="rounded-lg border border-gray-300 px-4 py-2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {[['Total Fees Collected', formatCurrency(filtered.filter((item) => item.collection_type === 'monthly_fee').reduce((sum, item) => sum + Number(item.amount_collected || 0), 0)), '#16A34A'], ['Total Deposits Collected', formatCurrency(filtered.filter((item) => item.collection_type === 'refundable_deposit').reduce((sum, item) => sum + Number(item.amount_collected || 0), 0)), '#2AA0D3'], ['Pending Amount', formatCurrency(filtered.filter((item) => item.incubation_fee_invoices && item.incubation_fee_invoices.amount > item.amount_collected).reduce((sum, item) => sum + Math.max((item.incubation_fee_invoices?.amount || 0) - item.amount_collected, 0), 0)), '#F59E0B'], ['Overdue Amount', formatCurrency(filtered.filter((item) => item.incubation_fee_invoices && new Date(item.incubation_fee_invoices.due_date) < new Date()).reduce((sum, item) => sum + Number(item.amount_collected || 0), 0)), '#DC2626'], ['Paid Companies', new Set(filtered.filter((item) => item.collection_type === 'monthly_fee').map((item) => item.company_id)).size, '#7C3AED'], ['Overdue Companies', new Set(filtered.filter((item) => item.incubation_fee_invoices && new Date(item.incubation_fee_invoices.due_date) < new Date()).map((item) => item.company_id)).size, '#0EA5A0']].map(([label, value, color]) => <Card key={String(label)} className="border-0 shadow p-5"><p className="mb-1 text-xs font-semibold uppercase text-[#8A8A8A]">{label}</p><p className="text-xl font-bold" style={{ color: String(color) }}>{value}</p></Card>)}
      </div>

      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F5F6F7' }}>
                {['Receipt Number', 'Company', 'Collection Type', 'Billing Month', 'Amount', 'Payment Date', 'Payment Mode', 'Transaction Reference', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((transaction) => (
                <tr key={transaction.id} className="border-t border-gray-200">
                  <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{transaction.receipt_number}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{transaction.applications?.business_name || transaction.applications?.email || '-'}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{transaction.collection_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{transaction.incubation_fee_invoices?.billing_month ? formatBillingMonth(transaction.incubation_fee_invoices.billing_month) : '-'}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(transaction.amount_collected)}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{transaction.collection_date}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{transaction.payment_mode.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{transaction.transaction_reference || '-'}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{transaction.status}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => downloadReceiptPdf({ receiptNumber: transaction.receipt_number, receiptDate: transaction.collection_date, companyName: transaction.applications?.business_name || transaction.applications?.email || 'Company', collectionType: transaction.collection_type.replace(/_/g, ' '), invoiceNumber: transaction.incubation_fee_invoices?.invoice_number || null, billingMonth: transaction.incubation_fee_invoices?.billing_month ? formatBillingMonth(transaction.incubation_fee_invoices.billing_month) : null, depositReference: transaction.deposit_id, amountPaid: transaction.amount_collected, paymentMode: transaction.payment_mode.replace(/_/g, ' '), transactionReference: transaction.transaction_reference || null, receivedBy: transaction.collected_by || null })} className="rounded-lg bg-[#2AA0D3] px-3 py-1 text-xs font-semibold text-white">Receipt</button>
                      <button onClick={() => startEdit(transaction)} className="rounded-lg border border-[#FF3B3B] px-3 py-1 text-xs font-semibold text-[#FF3B3B]">Edit</button>
                      <button onClick={() => handleDelete(transaction)} className="rounded-lg border border-[#D32F2F] px-3 py-1 text-xs font-semibold text-[#D32F2F]">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold" style={{ color: '#FF3B3B' }}>Edit Transaction</h3>
            <div className="space-y-4">
              <input type="date" value={editForm.collection_date} onChange={(e) => setEditForm((prev) => ({ ...prev, collection_date: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
              <select value={editForm.payment_mode} onChange={(e) => setEditForm((prev) => ({ ...prev, payment_mode: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">{PAYMENT_MODE_OPTIONS.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select>
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
