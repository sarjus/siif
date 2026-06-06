'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReportPdf, exportCsv, formatCurrency } from '@/lib/fee-management';
import { loadLogoForPdf } from '@/lib/pdf-logo';

type Entry = { id: string; entry_date: string; particulars: string; debit: number; credit: number; category: string | null; reference: string | null };

export default function LedgerReportPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    const session = await getSafeSession(); if (!session) { router.push('/login'); return; }
    setUserEmail(session.user.email || '');
    try {
      const res = await fetch('/api/admin/fee-management/reports', { headers: await getAuthHeaders() });
      const p = await res.json(); if (!res.ok) throw new Error(p.error);
      setData(p.ledger || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const { rows, totals } = useMemo(() => {
    let balance = 0;
    const rows = data.map((e) => {
      balance += Number(e.credit || 0) - Number(e.debit || 0);
      return [e.entry_date, e.particulars, e.category || '-', e.reference || '-', e.debit > 0 ? formatCurrency(e.debit) : '-', e.credit > 0 ? formatCurrency(e.credit) : '-', `${formatCurrency(Math.abs(balance))} ${balance >= 0 ? 'Cr' : 'Dr'}`];
    });
    const totals = { debit: data.reduce((s, e) => s + Number(e.debit || 0), 0), credit: data.reduce((s, e) => s + Number(e.credit || 0), 0) };
    return { rows, totals };
  }, [data]);

  const handleExportPdf = async () => { const logo = await loadLogoForPdf(); downloadReportPdf({ title: 'Ledger Report', headers: ['Date', 'Particulars', 'Category', 'Reference', 'Debit', 'Credit', 'Balance'], rows, logoDataUrl: logo }); };
  const handleExportCsv = () => exportCsv('ledger-report.csv', ['Date', 'Particulars', 'Category', 'Reference', 'Debit', 'Credit', 'Balance'], rows);
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Ledger Report" subtitle="Full general ledger with running balance" userEmail={userEmail} onLogout={handleLogout}
      headerActions={<div className="flex gap-2"><button onClick={handleExportCsv} className="rounded-lg border border-[#2AA0D3] px-4 py-2 text-sm font-semibold text-[#2AA0D3]">Export Excel</button><button onClick={handleExportPdf} className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white">Export PDF</button></div>}>
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[['Total Debit', totals.debit, '#DC2626'], ['Total Credit', totals.credit, '#16A34A'], ['Net Balance', Math.abs(totals.credit - totals.debit), totals.credit - totals.debit >= 0 ? '#16A34A' : '#DC2626']].map(([l, v, c]) => (
          <Card key={String(l)} className="border-0 shadow p-5"><p className="text-xs font-bold uppercase text-[#8A8A8A]">{l}</p><p className="text-2xl font-bold" style={{ color: String(c) }}>{formatCurrency(Number(v))}<span className="ml-1 text-sm font-normal text-[#8A8A8A]">{String(l) === 'Net Balance' ? (totals.credit - totals.debit >= 0 ? 'Cr' : 'Dr') : ''}</span></p></Card>
        ))}
      </div>
      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr style={{ backgroundColor: '#172033' }}>{['Date', 'Particulars', 'Category', 'Reference', 'Debit', 'Credit', 'Balance'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase text-white">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No entries.</td></tr> : rows.map((row, i) => <tr key={i} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>{row.map((cell, j) => <td key={j} className={`px-4 py-3 text-sm ${j === 4 && String(cell) !== '-' ? 'font-semibold text-[#DC2626]' : j === 5 && String(cell) !== '-' ? 'font-semibold text-[#16A34A]' : j === 6 ? 'font-bold' : 'text-[#4A4A4A]'}`}>{cell}</td>)}</tr>)}
            <tr className="border-t-2 border-[#172033] bg-[#F5F6F7]"><td colSpan={4} className="px-4 py-3 text-sm font-bold">TOTAL</td><td className="px-4 py-3 text-sm font-bold text-[#DC2626]">{formatCurrency(totals.debit)}</td><td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{formatCurrency(totals.credit)}</td><td className="px-4 py-3 text-sm font-bold" style={{ color: totals.credit - totals.debit >= 0 ? '#16A34A' : '#DC2626' }}>{formatCurrency(Math.abs(totals.credit - totals.debit))} <span className="text-xs text-[#8A8A8A]">{totals.credit - totals.debit >= 0 ? 'Cr' : 'Dr'}</span></td></tr>
          </tbody>
        </table></div>
      </Card>
    </AdminShell>
  );
}
