'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReportPdf, exportCsv, formatBillingMonth, formatCurrency } from '@/lib/fee-management';

type CompanyName = { business_name: string | null } | null;

type CollectionReportRow = {
  collection_type: string;
  collection_date: string;
  amount_collected: number;
  payment_mode: string;
  applications: CompanyName;
};

type InvoiceReportRow = {
  billing_month: string;
  amount: number;
  amount_paid: number;
  status: string;
  applications: CompanyName;
};

type DepositReportRow = {
  deposit_amount: number;
  amount_collected: number;
  amount_refunded: number;
  balance_amount: number;
  status: string;
  applications: CompanyName;
};

type StaffPaymentRow = {
  payment_number: string;
  payment_type: string;
  payment_month: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  transaction_reference: string | null;
  siif_staff?: { name: string; designation: string } | null;
};

export default function FeeReportsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<CollectionReportRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceReportRow[]>([]);
  const [deposits, setDeposits] = useState<DepositReportRow[]>([]);
  const [staffPayments, setStaffPayments] = useState<StaffPaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');

      const headers = await getAuthHeaders();
      const [reportsRes, staffRes] = await Promise.all([
        fetch('/api/admin/fee-management/reports', { headers }),
        fetch('/api/admin/staff/payments', { headers }),
      ]);

      const payload = await reportsRes.json();
      if (!reportsRes.ok) throw new Error(payload?.error || 'Failed to load reports');

      setCollections((payload.collections || []) as CollectionReportRow[]);
      setInvoices((payload.invoices || []) as InvoiceReportRow[]);
      setDeposits((payload.deposits || []) as DepositReportRow[]);

      if (staffRes.ok) {
        const staffPayload = await staffRes.json();
        setStaffPayments((staffPayload.payments || []) as StaffPaymentRow[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const monthLabel = (paymentMonth: string) => {
    const [year, month] = paymentMonth.slice(0, 7).split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const collectionRows = useMemo(() =>
    collections.map((item) => [item.applications?.business_name || '-', item.collection_type.replace(/_/g, ' '), item.collection_date, formatCurrency(item.amount_collected), item.payment_mode.replace(/_/g, ' ')]),
    [collections]);

  const outstandingRows = useMemo(() =>
    invoices.filter((item) => item.status !== 'paid').map((item) => {
      const balance = Math.max(Number(item.amount || 0) - Number(item.amount_paid || 0), 0);
      return [item.applications?.business_name || '-', formatBillingMonth(item.billing_month), formatCurrency(item.amount), formatCurrency(item.amount_paid), formatCurrency(balance), item.status];
    }), [invoices]);

  const depositRows = useMemo(() =>
    deposits.map((item) => [item.applications?.business_name || '-', formatCurrency(item.deposit_amount), formatCurrency(item.amount_collected), formatCurrency(item.amount_refunded), formatCurrency(item.balance_amount), item.status]),
    [deposits]);

  const staffPaymentRows = useMemo(() =>
    staffPayments.map((p) => [
      p.payment_number,
      p.siif_staff?.name || '-',
      p.siif_staff?.designation || '-',
      p.payment_type.charAt(0).toUpperCase() + p.payment_type.slice(1),
      monthLabel(p.payment_month),
      formatCurrency(p.amount),
      p.payment_date,
      p.payment_mode.replace(/_/g, ' ').toUpperCase(),
      p.transaction_reference || '-',
    ]),
    [staffPayments]);

  const totalStaffPaid = useMemo(() =>
    staffPayments.reduce((s, p) => s + Number(p.amount || 0), 0), [staffPayments]);

  const totalIncome = useMemo(() =>
    collections.reduce((s, c) => s + Number(c.amount_collected || 0), 0), [collections]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleExportPdf = useCallback(async (reportTitle: string, headers: string[], rows: Array<Array<string | number>>) => {
    let logoDataUrl: string | undefined;
    try {
      const res = await fetch('/assets/SIIF Logo.png');
      const blob = await res.blob();
      logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch { /* proceed without logo */ }
    downloadReportPdf({ title: reportTitle, headers, rows, logoDataUrl });
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Reports & Analytics" subtitle="Collection, outstanding, deposit and staff payment analysis with export options" userEmail={userEmail} onLogout={handleLogout}>
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          ['Total Income', formatCurrency(totalIncome), '#16A34A'],
          ['Outstanding Amount', formatCurrency(invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + Math.max(Number(i.amount || 0) - Number(i.amount_paid || 0), 0), 0)), '#DC2626'],
          ['Deposit Balance', formatCurrency(deposits.reduce((s, i) => s + Number(i.balance_amount || 0), 0)), '#2AA0D3'],
          ['Total Staff Payments', formatCurrency(totalStaffPaid), '#FF3B3B'],
        ].map(([label, value, color]) => (
          <Card key={String(label)} className="border-0 shadow p-5">
            <p className="mb-1 text-xs font-semibold uppercase text-[#8A8A8A]">{label}</p>
            <p className="text-2xl font-bold" style={{ color: String(color) }}>{value}</p>
          </Card>
        ))}
      </div>

      {/* Net position */}
      <Card className="mb-6 border-0 shadow p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-[#8A8A8A]">Net Position (Income − Staff Payments)</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: totalIncome - totalStaffPaid >= 0 ? '#16A34A' : '#DC2626' }}>
            {formatCurrency(totalIncome - totalStaffPaid)}
          </p>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-sm font-bold text-white ${totalIncome - totalStaffPaid >= 0 ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}>
          {totalIncome - totalStaffPaid >= 0 ? 'Surplus' : 'Deficit'}
        </span>
      </Card>

      {/* Report tables */}
      <div className="space-y-6">
        {[
          ['Collection Report', ['Company', 'Collection Type', 'Date', 'Amount', 'Payment Mode'], collectionRows],
          ['Outstanding Report', ['Company', 'Billing Month', 'Amount', 'Paid', 'Outstanding', 'Status'], outstandingRows],
          ['Deposit Report', ['Company', 'Deposit Amount', 'Collected', 'Refunded', 'Balance', 'Status'], depositRows],
          ['Staff Payments Report', ['Payment No.', 'Staff Name', 'Designation', 'Type', 'Month', 'Amount', 'Date', 'Mode', 'Reference'], staffPaymentRows],
        ].map(([title, headers, rows]) => (
          <Card key={String(title)} className="border-0 shadow p-6">
            <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h3 className="text-lg font-bold" style={{ color: '#FF3B3B' }}>{title}</h3>
              <div className="flex gap-2">
                <button onClick={() => exportCsv(`${String(title).toLowerCase().replace(/\s+/g, '-')}.csv`, headers as string[], rows as Array<Array<string | number>>)} className="rounded-lg border border-[#2AA0D3] px-4 py-2 text-sm font-semibold text-[#2AA0D3]">Export Excel</button>
                <button onClick={() => handleExportPdf(String(title), headers as string[], rows as Array<Array<string | number>>)} className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white">Export PDF</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F5F6F7' }}>
                    {(headers as string[]).map((h) => <th key={h} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(rows as Array<Array<string | number>>).length === 0 ? (
                    <tr><td colSpan={(headers as string[]).length} className="px-4 py-6 text-center text-sm text-[#8A8A8A]">No data available.</td></tr>
                  ) : (rows as Array<Array<string | number>>).map((row, rowIndex) => (
                    <tr key={`${String(title)}-${rowIndex}`} className="border-t border-gray-200">
                      {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-4 text-sm text-[#4A4A4A]">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}