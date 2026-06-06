'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReportPdf, exportCsv, formatBillingMonth, formatCurrency } from '@/lib/fee-management';
import { loadLogoForPdf } from '@/lib/pdf-logo';

type Row = { billing_month: string; amount: number; amount_paid: number; status: string; applications: { business_name: string | null } | null };

export default function OutstandingReportPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Row[]>([]);

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

  const unpaid = useMemo(() => data.filter((i) => i.status !== 'paid'), [data]);
  const rows = useMemo(() => unpaid.map((item) => {
    const balance = Math.max(Number(item.amount || 0) - Number(item.amount_paid || 0), 0);
    return [item.applications?.business_name || '-', formatBillingMonth(item.billing_month), formatCurrency(item.amount), formatCurrency(item.amount_paid), formatCurrency(balance), item.status];
  }), [unpaid]);
  const totalOutstanding = useMemo(() => unpaid.reduce((s, i) => s + Math.max(Number(i.amount || 0) - Number(i.amount_paid || 0), 0), 0), [unpaid]);

  const handleExportPdf = async () => { const logo = await loadLogoForPdf(); downloadReportPdf({ title: 'Outstanding Report', headers: ['Company', 'Month', 'Amount', 'Paid', 'Outstanding', 'Status'], rows, logoDataUrl: logo }); };
  const handleExportCsv = () => exportCsv('outstanding-report.csv', ['Company', 'Month', 'Amount', 'Paid', 'Outstanding', 'Status'], rows);
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Outstanding Report" subtitle="Unpaid and partially paid invoices" userEmail={userEmail} onLogout={handleLogout}
      headerActions={<div className="flex gap-2"><button onClick={handleExportCsv} className="rounded-lg border border-[#2AA0D3] px-4 py-2 text-sm font-semibold text-[#2AA0D3]">Export Excel</button><button onClick={handleExportPdf} className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white">Export PDF</button></div>}>
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      <div className="mb-6"><Card className="border-0 shadow p-5 inline-block"><p className="text-xs font-bold uppercase text-[#8A8A8A]">Total Outstanding</p><p className="text-2xl font-bold text-[#DC2626]">{formatCurrency(totalOutstanding)}</p></Card></div>
      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr style={{ backgroundColor: '#F5F6F7' }}>{['Company', 'Billing Month', 'Amount', 'Paid', 'Outstanding', 'Status'].map((h) => <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No outstanding dues.</td></tr> : rows.map((row, i) => <tr key={i} className="border-t border-gray-200">{row.map((cell, j) => <td key={j} className={`px-4 py-3 text-sm ${j === 4 ? 'font-bold text-[#DC2626]' : 'text-[#4A4A4A]'}`}>{cell}</td>)}</tr>)}
            <tr className="border-t-2 border-[#172033] bg-[#F5F6F7]"><td colSpan={4} className="px-4 py-3 text-sm font-bold">TOTAL OUTSTANDING</td><td className="px-4 py-3 text-sm font-bold text-[#DC2626]">{formatCurrency(totalOutstanding)}</td><td /></tr>
          </tbody>
        </table></div>
      </Card>
    </AdminShell>
  );
}
