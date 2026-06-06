'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReportPdf, exportCsv, formatCurrency } from '@/lib/fee-management';
import { loadLogoForPdf } from '@/lib/pdf-logo';

type Payment = { payment_number: string; payment_type: string; payment_month: string; amount: number; payment_mode: string; payment_date: string; transaction_reference: string | null; siif_staff?: { name: string; designation: string } | null };

const monthLabel = (m: string) => { const [y, mo] = m.slice(0, 7).split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };

export default function StaffPaymentsReportPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payment[]>([]);

  const load = useCallback(async () => {
    const session = await getSafeSession(); if (!session) { router.push('/login'); return; }
    setUserEmail(session.user.email || '');
    try {
      const res = await fetch('/api/admin/staff/payments', { headers: await getAuthHeaders() });
      const p = await res.json(); if (!res.ok) throw new Error(p.error);
      setData(p.payments || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => data.map((p) => [p.payment_number, p.siif_staff?.name || '-', p.siif_staff?.designation || '-', p.payment_type.charAt(0).toUpperCase() + p.payment_type.slice(1), monthLabel(p.payment_month), formatCurrency(p.amount), p.payment_date, p.payment_mode.replace(/_/g, ' ').toUpperCase(), p.transaction_reference || '-']), [data]);
  const total = useMemo(() => data.reduce((s, p) => s + Number(p.amount || 0), 0), [data]);

  const handleExportPdf = async () => { const logo = await loadLogoForPdf(); downloadReportPdf({ title: 'Staff Payments Report', headers: ['Payment No.', 'Staff', 'Designation', 'Type', 'Month', 'Amount', 'Date', 'Mode', 'Reference'], rows, logoDataUrl: logo }); };
  const handleExportCsv = () => exportCsv('staff-payments-report.csv', ['Payment No.', 'Staff', 'Designation', 'Type', 'Month', 'Amount', 'Date', 'Mode', 'Reference'], rows);
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Staff Payments Report" subtitle="Salary and honorarium disbursements to staff" userEmail={userEmail} onLogout={handleLogout}
      headerActions={<div className="flex gap-2"><button onClick={handleExportCsv} className="rounded-lg border border-[#2AA0D3] px-4 py-2 text-sm font-semibold text-[#2AA0D3]">Export Excel</button><button onClick={handleExportPdf} className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white">Export PDF</button></div>}>
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      <div className="mb-6"><Card className="border-0 shadow p-5 inline-block"><p className="text-xs font-bold uppercase text-[#8A8A8A]">Total Disbursed</p><p className="text-2xl font-bold text-[#7C3AED]">{formatCurrency(total)}</p></Card></div>
      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr style={{ backgroundColor: '#F5F6F7' }}>{['Payment No.', 'Staff Name', 'Designation', 'Type', 'Month', 'Amount', 'Date', 'Mode', 'Reference'].map((h) => <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No payments recorded.</td></tr> : rows.map((row, i) => <tr key={i} className="border-t border-gray-200">{row.map((cell, j) => <td key={j} className={`px-4 py-3 text-sm ${j === 5 ? 'font-bold text-[#7C3AED]' : 'text-[#4A4A4A]'}`}>{cell}</td>)}</tr>)}
            <tr className="border-t-2 border-[#172033] bg-[#F5F6F7]"><td colSpan={5} className="px-4 py-3 text-sm font-bold">TOTAL</td><td className="px-4 py-3 text-sm font-bold text-[#7C3AED]">{formatCurrency(total)}</td><td colSpan={3} /></tr>
          </tbody>
        </table></div>
      </Card>
    </AdminShell>
  );
}
