'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReportPdf, exportCsv, formatBillingMonth, formatCurrency } from '@/lib/fee-management';

type CompanyName = {
  business_name: string | null;
} | null;

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

export default function FeeReportsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<CollectionReportRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceReportRow[]>([]);
  const [deposits, setDeposits] = useState<DepositReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');

      const response = await fetch('/api/admin/fee-management/reports', {
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load reports');
      }

      setCollections((payload.collections || []) as CollectionReportRow[]);
      setInvoices((payload.invoices || []) as InvoiceReportRow[]);
      setDeposits((payload.deposits || []) as DepositReportRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const collectionRows = useMemo(() => collections.map((item) => [item.applications?.business_name || '-', item.collection_type, item.collection_date, formatCurrency(item.amount_collected), item.payment_mode]), [collections]);
  const outstandingRows = useMemo(() => invoices.filter((item) => item.status !== 'paid').map((item) => {
    const balance = Math.max(Number(item.amount || 0) - Number(item.amount_paid || 0), 0);
    return [
      item.applications?.business_name || '-',
      formatBillingMonth(item.billing_month),
      formatCurrency(item.amount),
      formatCurrency(item.amount_paid),
      formatCurrency(balance),
      item.status,
    ];
  }), [invoices]);
  const depositRows = useMemo(() => deposits.map((item) => [item.applications?.business_name || '-', formatCurrency(item.deposit_amount), formatCurrency(item.amount_collected), formatCurrency(item.amount_refunded), formatCurrency(item.balance_amount), item.status]), [deposits]);

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
    <AdminShell title="Reports & Analytics" subtitle="Collection, outstanding, and deposit analysis with export options" userEmail={userEmail} onLogout={handleLogout}>
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[['Monthly Collection', formatCurrency(collections.reduce((sum, item) => sum + Number(item.amount_collected || 0), 0)), '#FF3B3B'], ['Outstanding Amount', formatCurrency(invoices.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + Math.max(Number(item.amount || 0) - Number(item.amount_paid || 0), 0), 0)), '#DC2626'], ['Deposit Balance', formatCurrency(deposits.reduce((sum, item) => sum + Number(item.balance_amount || 0), 0)), '#2AA0D3']].map(([label, value, color]) => <Card key={String(label)} className="border-0 shadow p-5"><p className="mb-1 text-xs font-semibold uppercase text-[#8A8A8A]">{label}</p><p className="text-2xl font-bold" style={{ color: String(color) }}>{value}</p></Card>)}
      </div>

      <div className="space-y-6">
        {[
          ['Collection Report', ['Company', 'Collection Type', 'Collection Date', 'Amount', 'Payment Mode'], collectionRows],
          ['Outstanding Report', ['Company', 'Billing Month', 'Amount', 'Paid', 'Outstanding', 'Status'], outstandingRows],
          ['Deposit Report', ['Company', 'Deposit Amount', 'Collected', 'Refunded', 'Balance', 'Status'], depositRows],
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
                    {(headers as string[]).map((heading) => <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(rows as Array<Array<string | number>>).map((row, rowIndex) => (
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
