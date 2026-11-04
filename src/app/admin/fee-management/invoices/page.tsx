'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { database, getSafeSession, getAuthHeaders } from '@/lib/database';
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
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [fixingMonth, setFixingMonth] = useState(false);
  const [sortKey, setSortKey] = useState<'invoice' | 'company' | 'month'>('month');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [generateMonth, setGenerateMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  const [renumbering, setRenumbering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [savingInvoiceId, setSavingInvoiceId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');

      const response = await fetch('/api/admin/fee-management/invoices', {
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load invoices');
      }

      setInvoices((payload.invoices || []) as InvoiceRow[]);
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

  const sortedInvoices = useMemo(() => {
    const getValue = (invoice: InvoiceRow) => {
      if (sortKey === 'invoice') return invoice.invoice_number || '';
      if (sortKey === 'company') return invoice.applications?.business_name || '';
      return invoice.billing_month || '';
    };
    const direction = sortDir === 'asc' ? 1 : -1;
    return [...filteredInvoices].sort(
      (a, b) =>
        direction *
        getValue(a).localeCompare(getValue(b), undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [filteredInvoices, sortKey, sortDir]);

  const toggleSort = (key: 'invoice' | 'company' | 'month') => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

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

  const handleFixBillingMonth = async (fromMonth: string, toMonth: string) => {
    setFixingMonth(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/fee-management/update-billing-month', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromMonth, toMonth }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update billing month');
      }

      alert(payload.message || 'Billing month updated successfully');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update billing month');
    } finally {
      setFixingMonth(false);
    }
  };

  const handleDeleteInvoice = async (invoice: InvoiceRow) => {
    const confirmed = window.confirm(
      `Delete invoice ${invoice.invoice_number}? This will remove it from monthly invoices.`
    );
    if (!confirmed) return;

    setDeletingInvoiceId(invoice.id);
    setError(null);

    try {
      const response = await fetch('/api/admin/fee-management/invoices', {
        method: 'DELETE',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete invoice');
      }

      setInvoices((current) => current.filter((item) => item.id !== invoice.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  const handleGenerateMonth = async () => {
    if (!generateMonth) {
      setError('Select a month to generate invoices for.');
      return;
    }
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/fee-management/run-monthly-cycle', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: generateMonth }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to generate invoices');
      setNotice(payload.message || `Invoices created for ${generateMonth}: ${payload.created}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveInvoiceNumber = async (invoice: InvoiceRow) => {
    const value = editingValue.trim();
    if (!value) {
      setError('Invoice number cannot be empty.');
      return;
    }
    if (value === invoice.invoice_number) {
      setEditingInvoiceId(null);
      return;
    }
    setSavingInvoiceId(invoice.id);
    setError(null);
    try {
      const response = await fetch('/api/admin/fee-management/invoices', {
        method: 'PATCH',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, invoiceNumber: value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to update invoice number');
      setInvoices((current) =>
        current.map((item) => (item.id === invoice.id ? { ...item, invoice_number: value } : item))
      );
      setEditingInvoiceId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice number');
    } finally {
      setSavingInvoiceId(null);
    }
  };

  const handleRenumber = async () => {
    if (!window.confirm('Renumber ALL invoices sequentially by billing month? Existing invoice numbers (including manual edits) will change.')) return;
    setRenumbering(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/fee-management/invoices/renumber', {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to renumber invoices');
      setNotice(`Renumbered ${payload.updated} invoice(s).`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to renumber invoices');
    } finally {
      setRenumbering(false);
    }
  };

  const handleLogout = async () => {
    await database.auth.signOut();
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
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={generateMonth}
            max={new Date().toISOString().slice(0, 7)}
            onChange={(e) => setGenerateMonth(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={handleGenerateMonth} disabled={generating} className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-white font-semibold hover:bg-red-700 disabled:opacity-50">
            {generating ? 'Generating...' : 'Generate Invoices'}
          </button>
          {invoices.some((inv) => inv.billing_month?.startsWith('2026-05')) && (
            <button
              onClick={() => handleFixBillingMonth('2026-05-01', '2026-06-01')}
              disabled={fixingMonth}
              className="rounded-lg bg-[#F59E0B] px-4 py-2 text-white font-semibold hover:bg-[#D97706] disabled:opacity-50"
            >
              {fixingMonth ? 'Updating...' : 'Fix: May → June 2026'}
            </button>
          )}
          <button onClick={handleRenumber} disabled={renumbering} className="rounded-lg bg-[#7C3AED] px-4 py-2 text-white font-semibold hover:bg-[#6D28D9] disabled:opacity-50">
            {renumbering ? 'Renumbering...' : 'Renumber in Order'}
          </button>
          <button onClick={handleSync} disabled={syncing} className="rounded-lg bg-[#2AA0D3] px-4 py-2 text-white font-semibold hover:bg-[#2289b5] disabled:opacity-50">
            {syncing ? 'Syncing...' : 'Sync Invoices'}
          </button>
        </div>
      }
    >
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-6 rounded-lg bg-[#EAF9F0] p-4 text-sm text-[#1E7F46]">{notice}</div>}

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
                {([
                  ['Invoice', 'invoice'], ['Company', 'company'], ['Billing Month', 'month'],
                  ['Due Date', null], ['Amount', null], ['Paid', null], ['Status', null], ['Action', null],
                ] as const).map(([heading, key]) => (
                  <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">
                    {key ? (
                      <button onClick={() => toggleSort(key)} className="flex items-center gap-1 font-semibold hover:text-[#FF3B3B]">
                        {heading}
                        <span className="text-xs">{sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                    ) : heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-gray-200">
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">
                    {editingInvoiceId === invoice.id ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveInvoiceNumber(invoice);
                          if (e.key === 'Escape') setEditingInvoiceId(null);
                        }}
                        className="w-40 rounded border border-gray-300 px-2 py-1"
                      />
                    ) : (
                      invoice.invoice_number
                    )}
                  </td>
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
                  <td className="px-4 py-4 flex gap-2">
                    {editingInvoiceId === invoice.id ? (
                      <>
                        <button
                          onClick={() => handleSaveInvoiceNumber(invoice)}
                          disabled={savingInvoiceId === invoice.id}
                          className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {savingInvoiceId === invoice.id ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingInvoiceId(null)}
                          className="rounded-lg bg-gray-300 px-3 py-1.5 text-xs font-semibold text-[#4A4A4A]"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setEditingInvoiceId(invoice.id); setEditingValue(invoice.invoice_number); }}
                        className="rounded-lg bg-[#2AA0D3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2289b5]"
                      >
                        Edit No.
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteInvoice(invoice)}
                      disabled={deletingInvoiceId === invoice.id}
                      className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
                    >
                      {deletingInvoiceId === invoice.id ? 'Deleting...' : 'Delete'}
                    </button>
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
