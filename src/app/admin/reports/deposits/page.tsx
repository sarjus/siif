'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReportPdf, exportCsv, formatCurrency } from '@/lib/fee-management';
import { loadLogoForPdf } from '@/lib/pdf-logo';

type Row = { deposit_amount: number; amount_collected: number; amount_refunded: number; balance_amount: number; status: string; applications: { business_name: string | null } | null };

export default function DepositReportPage() {
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
      setData((p.deposits || []).filter((d: Row) => Number(d.deposit_amount || 0) > 0));
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => data.map((item) => [item.applications?.business_name || '-', formatCurrency(item.deposit_amount), formatCurrency(item.amount_collected), formatCurrency(item.amount_refunded), formatCurrency(item.balance_amount), item.status]), [data]);
  const totals = useMemo(() => ({
    deposit: data.reduce((s, i) => s + Number(i.deposit_amount || 0), 0),
    collected: data.reduce((s, i) => s + Number(i.amount_collected || 0), 0),
    refunded: data.reduce((s, i) => s + Number(i.amount_refunded || 0), 0),
    balance: data.reduce((s, i) => s + Number(i.balance_amount || 0), 0),
  }), [data]);

  const handleExportPdf = async () => { const logo = await loadLogoForPdf(); downloadReportPdf({ title: 'Deposit Report', headers: ['Company', 'Deposit', 'Collected', 'Refunded', 'Balance', 'Status'], rows, logoDataUrl: logo }); };
  const handleExportCsv = () => exportCsv('deposit-report.csv', ['Company', 'Deposit', 'Collected', 'Refunded', 'Balance', 'Status'], rows);
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Deposit Report" subtitle="Refundable security deposits — collected, refunded and balance" userEmail={userEmail} onLogout={handleLogout}
      headerActions={<div className="flex gap-2"><button onClick={handleExportCsv} className="rounded-lg border border-[#2AA0D3] px-4 py-2 text-sm font-semibold text-[#2AA0D3]">Export Excel</button><button onClick={handleExportPdf} className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white">Export PDF</button></div>}>
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[['Total Deposit', totals.deposit, '#1D4ED8'], ['Total Collected', totals.collected, '#16A34A'], ['Total Refunded', totals.refunded, '#F59E0B'], ['Balance Remaining', totals.balance, '#2AA0D3']].map(([l, v, c]) => (
          <Card key={String(l)} className="border-0 shadow p-5"><p className="text-xs font-bold uppercase text-[#8A8A8A]">{l}</p><p className="text-xl font-bold" style={{ color: String(c) }}>{formatCurrency(Number(v))}</p></Card>
        ))}
      </div>
      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr style={{ backgroundColor: '#F5F6F7' }}>{['Company', 'Deposit Amount', 'Collected', 'Refunded', 'Balance', 'Status'].map((h) => <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No deposits configured.</td></tr> : rows.map((row, i) => <tr key={i} className="border-t border-gray-200">{row.map((cell, j) => <td key={j} className="px-4 py-3 text-sm text-[#4A4A4A]">{cell}</td>)}</tr>)}
            <tr className="border-t-2 border-[#172033] bg-[#F5F6F7]"><td className="px-4 py-3 text-sm font-bold">TOTAL</td><td className="px-4 py-3 text-sm font-bold text-[#1D4ED8]">{formatCurrency(totals.deposit)}</td><td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{formatCurrency(totals.collected)}</td><td className="px-4 py-3 text-sm font-bold text-[#F59E0B]">{formatCurrency(totals.refunded)}</td><td className="px-4 py-3 text-sm font-bold text-[#2AA0D3]">{formatCurrency(totals.balance)}</td><td /></tr>
          </tbody>
        </table></div>
      </Card>
    </AdminShell>
  );
}
