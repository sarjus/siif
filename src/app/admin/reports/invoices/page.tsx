'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReportPdf, exportCsv, formatBillingMonth, formatCurrency, INVOICE_STATUS_COLORS, type InvoiceStatus } from '@/lib/fee-management';
import { loadLogoForPdf } from '@/lib/pdf-logo';

type Row = { billing_month: string; amount: number; amount_paid: number; status: string; applications: { business_name: string | null } | null };

export default function InvoiceReportPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    const session = await getSafeSession(); if (!session) { router.push('/login'); return; }
    setUserEmail(session.user.email || '');
    try {
      const res = await fetch('/api/admin/fee-management/reports', { headers: await getAuthHeaders() });
      const p = await res.json(); if (!res.ok) throw new Error(p.error);
      setData(p.invoices || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => statusFilter === 'all' ? data : data.filter((i) => i.status === statusFilter), [data, statusFilter]);

  const rows = useMemo(() => filtered.map((item) => [
    item.applications?.business_name || '-',
    formatBillingMonth(item.billing_month),
    formatCurrency(item.amount),
    formatCurrency(item.amount_paid),
    formatCurrency(Math.max(Number(item.amount || 0) - Number(item.amount_paid || 0), 0)),
    item.status,
  ]), [filtered]);

  const totals = useMemo(() => ({
    billed: filtered.reduce((s, i) => s + Number(i.amount || 0), 0),
    paid: filtered.reduce((s, i) => s + Number(i.amount_paid || 0), 0),
    outstanding: filtered.reduce((s, i) => s + Math.max(Number(i.amount || 0) - Number(i.amount_paid || 0), 0), 0),
  }), [filtered]);

  const handleExportPdf = async () => { const logo = await loadLogoForPdf(); downloadReportPdf({ title: 'Invoice Report', headers: ['Company', 'Billing Month', 'Amount', 'Paid', 'Outstanding', 'Status'], rows, logoDataUrl: logo }); };
  const handleExportCsv = () => exportCsv('invoice-report.csv', ['Company', 'Billing Month', 'Amount', 'Paid', 'Outstanding', 'Status'], rows);
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Invoice Report" subtitle="All generated invoices — status, amounts and billing months" userEmail={userEmail} onLogout={handleLogout}
      headerActions={<div className="flex gap-2"><button onClick={handleExportCsv} className="rounded-lg border border-[#2AA0D3] px-4 py-2 text-sm font-semibold text-[#2AA0D3]">Export Excel</button><button onClick={handleExportPdf} className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white">Export PDF</button></div>}>
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}

      {/* Summary + filter */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow p-5"><p className="text-xs font-bold uppercase text-[#8A8A8A]">Total Billed</p><p className="text-xl font-bold text-[#1D4ED8]">{formatCurrency(totals.billed)}</p></Card>
        <Card className="border-0 shadow p-5"><p className="text-xs font-bold uppercase text-[#8A8A8A]">Total Paid</p><p className="text-xl font-bold text-[#16A34A]">{formatCurrency(totals.paid)}</p></Card>
        <Card className="border-0 shadow p-5"><p className="text-xs font-bold uppercase text-[#8A8A8A]">Outstanding</p><p className="text-xl font-bold text-[#DC2626]">{formatCurrency(totals.outstanding)}</p></Card>
        <div className="flex flex-col justify-end">
          <label className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">Filter by Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr style={{ backgroundColor: '#F5F6F7' }}>{['Company', 'Billing Month', 'Amount', 'Paid', 'Outstanding', 'Status'].map((h) => <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No invoices found.</td></tr>
              : filtered.map((item, i) => {
                const outstanding = Math.max(Number(item.amount || 0) - Number(item.amount_paid || 0), 0);
                return (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="px-4 py-3 text-sm text-[#4A4A4A]">{item.applications?.business_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-[#4A4A4A]">{formatBillingMonth(item.billing_month)}</td>
                    <td className="px-4 py-3 text-sm text-[#4A4A4A]">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#16A34A]">{formatCurrency(item.amount_paid)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#DC2626]">{outstanding > 0 ? formatCurrency(outstanding) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: INVOICE_STATUS_COLORS[item.status as InvoiceStatus] || '#9CA3AF' }}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            <tr className="border-t-2 border-[#172033] bg-[#F5F6F7]">
              <td colSpan={2} className="px-4 py-3 text-sm font-bold">TOTAL ({filtered.length} invoices)</td>
              <td className="px-4 py-3 text-sm font-bold text-[#1D4ED8]">{formatCurrency(totals.billed)}</td>
              <td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{formatCurrency(totals.paid)}</td>
              <td className="px-4 py-3 text-sm font-bold text-[#DC2626]">{formatCurrency(totals.outstanding)}</td>
              <td />
            </tr>
          </tbody>
        </table></div>
      </Card>
    </AdminShell>
  );
}
