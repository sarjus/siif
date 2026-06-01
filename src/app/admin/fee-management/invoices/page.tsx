'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { formatBillingMonth, formatCurrency, InvoiceRecord, INVOICE_STATUS_COLORS } from '@/lib/fee-management';

type InvoiceRow = InvoiceRecord & {
  applications: {
    business_name: string | null;
    email: string;
  } | null;
};

export default function MonthlyInvoicesPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');

      await fetch('/api/admin/fee-management/sync-invoices', {
        method: 'POST',
        headers: await getAuthHeaders(),
      });

      const { data, error: invoiceError } = await supabase
        .from('incubation_fee_invoices')
        .select('*, applications(business_name, email)')
        .order('billing_month', { ascending: false });

      if (invoiceError) throw invoiceError;
      setInvoices((data || []) as InvoiceRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      const searchValue = search.toLowerCase();
      const matchesSearch =
        (invoice.invoice_number || '').toLowerCase().includes(searchValue) ||
        (invoice.applications?.business_name || '').toLowerCase().includes(searchValue) ||
        (invoice.applications?.email || '').toLowerCase().includes(searchValue);
      return matchesStatus && matchesSearch;
    });
  }, [invoices, search, statusFilter]);

  const totals = useMemo(() => ({
    totalAmount: filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    totalPaid: filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0),
    overdue: filteredInvoices.filter((invoice) => invoice.status === 'overdue').length,
    pending: filteredInvoices.filter((invoice) => invoice.status === 'pending' || invoice.status === 'partially_paid').length,
  }), [filteredInvoices]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await fetch('/api/admin/fee-management/sync-invoices', {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync invoices');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell
      title="Monthly Invoices"
      subtitle="Generated invoices, due dates, and payment status for all incubated companies"
      userEmail={userEmail}
      onLogout={handleLogout}
      headerActions={
        <button onClick={handleSync} disabled={syncing} className="rounded-lg bg-[#2AA0D3] px-4 py-2 text-white font-semibold hover:bg-[#2289b5] disabled:opacity-50">
          {syncing ? 'Syncing...' : 'Sync Invoices'}
        </button>
      }
    >
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          ['Invoice Amount', formatCurrency(totals.totalAmount), '#FF3B3B'],
          ['Collected', formatCurrency(totals.totalPaid), '#16A34A'],
          ['Pending / Partial', String(totals.pending), '#F59E0B'],
          ['Overdue', String(totals.overdue), '#DC2626'],
        ].map(([label, value, color]) => (
          <Card key={label} className="border-0 shadow p-5">
            <p className="mb-2 text-xs font-semibold uppercase text-[#8A8A8A]">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice number, company, or email" className="rounded-lg border border-gray-300 px-4 py-2" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 px-4 py-2">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </Card>

      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F5F6F7' }}>
                {['Invoice', 'Company', 'Billing Month', 'Due Date', 'Amount', 'Paid', 'Status'].map((heading) => (
                  <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-gray-200">
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{invoice.invoice_number}</td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-[#4A4A4A]">{invoice.applications?.business_name || 'Company'}</div>
                    <div className="text-sm text-[#8A8A8A]">{invoice.applications?.email || '-'}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatBillingMonth(invoice.billing_month)}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{invoice.due_date}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(invoice.amount)}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(invoice.amount_paid)}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: INVOICE_STATUS_COLORS[invoice.status] }}>
                      {invoice.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
