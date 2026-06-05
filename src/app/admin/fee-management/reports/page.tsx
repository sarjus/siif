'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReportPdf, exportCsv, formatBillingMonth, formatCurrency } from '@/lib/fee-management';
import { loadLogoForPdf } from '@/lib/pdf-logo';

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

type LedgerRow = {
  id: string;
  entry_date: string;
  particulars: string;
  debit: number;
  credit: number;
  category: string | null;
  reference: string | null;
};

export default function FeeReportsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<CollectionReportRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceReportRow[]>([]);
  const [deposits, setDeposits] = useState<DepositReportRow[]>([]);
  const [staffPayments, setStaffPayments] = useState<StaffPaymentRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
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
      setLedger((payload.ledger || []) as LedgerRow[]);

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
    deposits
      .filter((item) => Number(item.deposit_amount || 0) > 0)
      .map((item) => [item.applications?.business_name || '-', formatCurrency(item.deposit_amount), formatCurrency(item.amount_collected), formatCurrency(item.amount_refunded), formatCurrency(item.balance_amount), item.status]),
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

  // Ledger rows with running balance
  const ledgerRows = useMemo(() => {
    let balance = 0;
    return ledger.map((e) => {
      balance += Number(e.credit || 0) - Number(e.debit || 0);
      const balanceStr = `${formatCurrency(Math.abs(balance))} ${balance >= 0 ? 'Cr' : 'Dr'}`;
      return [
        e.entry_date,
        e.particulars,
        e.category || '-',
        e.reference || '-',
        e.debit > 0 ? formatCurrency(e.debit) : '-',
        e.credit > 0 ? formatCurrency(e.credit) : '-',
        balanceStr,
      ];
    });
  }, [ledger]);

  const ledgerTotals = useMemo(() => ({
    debit: ledger.reduce((s, e) => s + Number(e.debit || 0), 0),
    credit: ledger.reduce((s, e) => s + Number(e.credit || 0), 0),
  }), [ledger]);

  const totalStaffPaid = useMemo(() =>
    staffPayments.reduce((s, p) => s + Number(p.amount || 0), 0), [staffPayments]);

  const totalIncome = useMemo(() =>
    collections.reduce((s, c) => s + Number(c.amount_collected || 0), 0), [collections]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleExportPdf = useCallback(async (reportTitle: string, headers: string[], rows: Array<Array<string | number>>) => {
    const logoDataUrl = await loadLogoForPdf();
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

      {/* Ledger summary card */}
      {ledger.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow p-5">
            <p className="mb-1 text-xs font-semibold uppercase text-[#8A8A8A]">Ledger Total Debit</p>
            <p className="text-2xl font-bold text-[#DC2626]">{formatCurrency(ledgerTotals.debit)}</p>
          </Card>
          <Card className="border-0 shadow p-5">
            <p className="mb-1 text-xs font-semibold uppercase text-[#8A8A8A]">Ledger Total Credit</p>
            <p className="text-2xl font-bold text-[#16A34A]">{formatCurrency(ledgerTotals.credit)}</p>
          </Card>
          <Card className="border-0 shadow p-5">
            <p className="mb-1 text-xs font-semibold uppercase text-[#8A8A8A]">Ledger Net Balance</p>
            <p className="text-2xl font-bold" style={{ color: ledgerTotals.credit - ledgerTotals.debit >= 0 ? '#16A34A' : '#DC2626' }}>
              {formatCurrency(Math.abs(ledgerTotals.credit - ledgerTotals.debit))}
              <span className="ml-1 text-sm font-normal text-[#8A8A8A]">
                {ledgerTotals.credit - ledgerTotals.debit >= 0 ? 'Cr' : 'Dr'}
              </span>
            </p>
          </Card>
        </div>
      )}

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

        {/* Ledger Report — custom card with totals row */}
        <Card className="border-0 shadow p-6">
          <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h3 className="text-lg font-bold" style={{ color: '#FF3B3B' }}>Ledger Report</h3>
            <div className="flex gap-2">
              <button
                onClick={() => exportCsv('ledger-report.csv',
                  ['Date', 'Particulars', 'Category', 'Reference', 'Debit', 'Credit', 'Balance'],
                  ledgerRows
                )}
                className="rounded-lg border border-[#2AA0D3] px-4 py-2 text-sm font-semibold text-[#2AA0D3]">
                Export Excel
              </button>
              <button
                onClick={() => handleExportPdf('Ledger Report',
                  ['Date', 'Particulars', 'Category', 'Reference', 'Debit', 'Credit', 'Balance'],
                  ledgerRows
                )}
                className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white">
                Export PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Date', 'Particulars', 'Category', 'Reference', 'Debit', 'Credit', 'Balance'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-[#8A8A8A]">No ledger entries available.</td></tr>
                ) : (
                  <>
                    {ledgerRows.map((row, i) => (
                      <tr key={`ledger-${i}`} className={`border-t border-gray-200 ${i % 2 === 0 ? '' : 'bg-[#FAFAFA]'}`}>
                        {row.map((cell, j) => (
                          <td key={j} className={`px-4 py-3 text-sm ${j === 4 && String(cell) !== '-' ? 'font-semibold text-[#DC2626]' : j === 5 && String(cell) !== '-' ? 'font-semibold text-[#16A34A]' : j === 6 ? 'font-bold text-[#172033]' : 'text-[#4A4A4A]'}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="border-t-2 border-[#172033] bg-[#F5F6F7]">
                      <td colSpan={4} className="px-4 py-3 text-sm font-bold text-[#172033]">TOTAL</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#DC2626]">{formatCurrency(ledgerTotals.debit)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{formatCurrency(ledgerTotals.credit)}</td>
                      <td className="px-4 py-3 text-sm font-bold" style={{ color: ledgerTotals.credit - ledgerTotals.debit >= 0 ? '#16A34A' : '#DC2626' }}>
                        {formatCurrency(Math.abs(ledgerTotals.credit - ledgerTotals.debit))}
                        <span className="ml-1 text-xs font-normal text-[#8A8A8A]">
                          {ledgerTotals.credit - ledgerTotals.debit >= 0 ? 'Cr' : 'Dr'}
                        </span>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}