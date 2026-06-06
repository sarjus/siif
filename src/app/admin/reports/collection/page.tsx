'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReportPdf, exportCsv, formatCurrency } from '@/lib/fee-management';
import { loadLogoForPdf } from '@/lib/pdf-logo';

type Row = { collection_type: string; collection_date: string; amount_collected: number; payment_mode: string; applications: { business_name: string | null } | null };

export default function CollectionReportPage() {
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
      const p = await res.json();
      if (!res.ok) throw new Error(p.error);
      setData(p.collections || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => data.map((item) => [item.applications?.business_name || '-', item.collection_type.replace(/_/g, ' '), item.collection_date, formatCurrency(item.amount_collected), item.payment_mode.replace(/_/g, ' ')]), [data]);
  const total = useMemo(() => data.reduce((s, i) => s + Number(i.amount_collected || 0), 0), [data]);

  const handleExportPdf = async () => { const logo = await loadLogoForPdf(); downloadReportPdf({ title: 'Collection Report', headers: ['Company', 'Type', 'Date', 'Amount', 'Mode'], rows, logoDataUrl: logo }); };
  const handleExportCsv = () => exportCsv('collection-report.csv', ['Company', 'Type', 'Date', 'Amount', 'Mode'], rows);
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Collection Report" subtitle="All fee payments received" userEmail={userEmail} onLogout={handleLogout}
      headerActions={<div className="flex gap-2"><button onClick={handleExportCsv} className="rounded-lg border border-[#2AA0D3] px-4 py-2 text-sm font-semibold text-[#2AA0D3]">Export Excel</button><button onClick={handleExportPdf} className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white">Export PDF</button></div>}>
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      <div className="mb-6"><Card className="border-0 shadow p-5 inline-block"><p className="text-xs font-bold uppercase text-[#8A8A8A]">Total Collected</p><p className="text-2xl font-bold text-[#16A34A]">{formatCurrency(total)}</p></Card></div>
      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr style={{ backgroundColor: '#F5F6F7' }}>{['Company', 'Collection Type', 'Date', 'Amount', 'Payment Mode'].map((h) => <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>)}</tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No data.</td></tr> : rows.map((row, i) => <tr key={i} className="border-t border-gray-200">{row.map((cell, j) => <td key={j} className={`px-4 py-3 text-sm ${j === 3 ? 'font-semibold text-[#16A34A]' : 'text-[#4A4A4A]'}`}>{cell}</td>)}</tr>)}
          <tr className="border-t-2 border-[#172033] bg-[#F5F6F7]"><td colSpan={3} className="px-4 py-3 text-sm font-bold">TOTAL</td><td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{formatCurrency(total)}</td><td /></tr>
          </tbody>
        </table></div>
      </Card>
    </AdminShell>
  );
}
