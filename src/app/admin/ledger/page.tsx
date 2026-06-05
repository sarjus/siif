'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { exportCsv, formatCurrency } from '@/lib/fee-management';

type LedgerEntry = {
  id: string;
  entry_date: string;
  particulars: string;
  debit: number;
  credit: number;
  category: string | null;
  reference: string | null;
  entered_by: string | null;
  notes: string | null;
  created_at: string;
};

type LedgerCategory = { id: string; name: string };

const emptyForm = {
  entryDate: new Date().toISOString().slice(0, 10),
  particulars: '',
  debit: '',
  credit: '',
  category: '',
  reference: '',
  notes: '',
};

export default function LedgerPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [categories, setCategories] = useState<LedgerCategory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [viewEntry, setViewEntry] = useState<LedgerEntry | null>(null);

  // Opening balance
  const [showOpeningBalance, setShowOpeningBalance] = useState(false);
  const [obForm, setObForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: '', type: 'credit' as 'credit' | 'debit' });
  const [obSaving, setObSaving] = useState(false);
  const [obError, setObError] = useState<string | null>(null);

  // Category management
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    const res = await fetch('/api/admin/ledger/categories', { headers: await getAuthHeaders() });
    if (res.ok) {
      const p = await res.json();
      setCategories(p.categories || []);
    }
  }, []);

  const loadEntries = useCallback(async (from?: string, to?: string) => {
    try {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');

      let url = '/api/admin/ledger';
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (params.toString()) url += `?${params.toString()}`;

      const headers = await getAuthHeaders();
      const [entriesRes] = await Promise.all([
        fetch(url, { headers }),
        loadCategories(),
      ]);

      const payload = await entriesRes.json();
      if (!entriesRes.ok) throw new Error(payload.error || 'Failed to load ledger');
      setEntries(payload.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [router, loadCategories]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleFilter = () => loadEntries(dateFrom || undefined, dateTo || undefined);
  const handleClearFilter = () => { setDateFrom(''); setDateTo(''); loadEntries(); };

  const handleSaveOpeningBalance = async () => {
    if (!obForm.amount || !obForm.date) { setObError('Date and amount are required.'); return; }
    const amt = Number(obForm.amount);
    if (isNaN(amt) || amt <= 0) { setObError('Amount must be greater than zero.'); return; }
    setObSaving(true); setObError(null);
    try {
      const res = await fetch('/api/admin/ledger', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate: obForm.date,
          particulars: 'Opening Balance',
          debit: obForm.type === 'debit' ? amt : 0,
          credit: obForm.type === 'credit' ? amt : 0,
          category: 'Opening Balance',
          reference: null,
          notes: 'Opening balance entry',
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to save opening balance');
      setNotice('Opening balance added successfully.');
      setShowOpeningBalance(false);
      setObForm({ date: new Date().toISOString().slice(0, 10), amount: '', type: 'credit' });
      await loadEntries(dateFrom || undefined, dateTo || undefined);
    } catch (err) {
      setObError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setObSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.particulars.trim() || !form.entryDate) {
      setError('Date and particulars are required.'); return;
    }
    if (!form.debit && !form.credit) {
      setError('Enter either a debit or credit amount.'); return;
    }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/admin/ledger', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate: form.entryDate,
          particulars: form.particulars,
          debit: form.debit ? Number(form.debit) : 0,
          credit: form.credit ? Number(form.credit) : 0,
          category: form.category || null,
          reference: form.reference || null,
          notes: form.notes || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to save entry');
      setNotice('Entry added successfully.');
      setForm(emptyForm);
      setShowForm(false);
      await loadEntries(dateFrom || undefined, dateTo || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, particulars: string) => {
    if (!confirm(`Delete entry "${particulars}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch('/api/admin/ledger', {
        method: 'DELETE',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (viewEntry?.id === id) setViewEntry(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) { setCatError('Category name is required.'); return; }
    setCatSaving(true); setCatError(null);
    try {
      const res = await fetch('/api/admin/ledger/categories', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to add category');
      setNewCatName('');
      await loadCategories();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: LedgerCategory) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    setDeletingCatId(cat.id);
    setCatError(null);
    try {
      const res = await fetch('/api/admin/ledger/categories', {
        method: 'DELETE',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: cat.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      await loadCategories();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingCatId(null);
    }
  };

  const filtered = useMemo(() =>
    filterCategory === 'all' ? entries : entries.filter((e) => e.category === filterCategory),
    [entries, filterCategory]);

  const withBalance = useMemo(() => {
    let balance = 0;
    return filtered.map((e) => {
      balance += Number(e.credit || 0) - Number(e.debit || 0);
      return { ...e, balance };
    });
  }, [filtered]);

  const totals = useMemo(() => ({
    debit: filtered.reduce((s, e) => s + Number(e.debit || 0), 0),
    credit: filtered.reduce((s, e) => s + Number(e.credit || 0), 0),
  }), [filtered]);

  const handleExport = () => {
    exportCsv('siif-ledger.csv',
      ['Date', 'Particulars', 'Category', 'Reference', 'Debit', 'Credit', 'Balance'],
      withBalance.map((e) => [
        e.entry_date, e.particulars, e.category || '-', e.reference || '-',
        e.debit > 0 ? e.debit : '', e.credit > 0 ? e.credit : '', e.balance,
      ])
    );
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // Category dropdown shared between form and filter
  const CategorySelect = ({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border border-gray-300 px-3 py-2 text-sm ${className}`}>
      <option value="">Select category</option>
      {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
    </select>
  );

  return (
    <AdminShell
      title="Ledger"
      subtitle="General ledger — track all income and expenditure with running balance"
      userEmail={userEmail}
      onLogout={handleLogout}
      headerActions={
        <div className="flex gap-2">
          <button onClick={() => { setShowOpeningBalance(true); setObError(null); }}
            className="rounded-lg border border-[#F59E0B] bg-[#FFFBEB] px-4 py-2 text-sm font-semibold text-[#92400E] hover:bg-[#FEF3C7]">
            Opening Balance
          </button>
          <button onClick={() => { setShowCatManager(true); setCatError(null); }}
            className="rounded-lg border border-[#E3E7EE] bg-white px-4 py-2 text-sm font-semibold text-[#344054] hover:bg-[#F8FAFC]">
            Manage Categories
          </button>
          <button onClick={handleExport}
            className="rounded-lg border border-[#2AA0D3] px-4 py-2 text-sm font-semibold text-[#2AA0D3] hover:bg-[#EFF9FF]">
            Export Excel
          </button>
          <button onClick={() => { setShowForm(true); setForm(emptyForm); setError(null); }}
            className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            + Add Entry
          </button>
        </div>
      }
    >
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-4 rounded-lg bg-[#EAF9F0] p-4 text-sm font-semibold text-[#1E7F46]">{notice}</div>}

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow p-5">
          <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">Total Debit (Expenditure)</p>
          <p className="text-2xl font-bold text-[#DC2626]">{formatCurrency(totals.debit)}</p>
        </Card>
        <Card className="border-0 shadow p-5">
          <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">Total Credit (Income)</p>
          <p className="text-2xl font-bold text-[#16A34A]">{formatCurrency(totals.credit)}</p>
        </Card>
        <Card className="border-0 shadow p-5">
          <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">Net Balance</p>
          <p className="text-2xl font-bold" style={{ color: totals.credit - totals.debit >= 0 ? '#16A34A' : '#DC2626' }}>
            {formatCurrency(Math.abs(totals.credit - totals.debit))}
            <span className="ml-1 text-sm font-normal text-[#8A8A8A]">
              {totals.credit - totals.debit >= 0 ? 'Cr' : 'Dr'}
            </span>
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6 border-0 shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-[#8A8A8A]">From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-[#8A8A8A]">To Date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-[#8A8A8A]">Category</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="all">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={handleFilter}
              className="flex-1 rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              Apply
            </button>
            <button onClick={handleClearFilter}
              className="rounded-lg border border-[#E3E7EE] px-4 py-2 text-sm font-semibold text-[#344054] hover:bg-[#F8FAFC]">
              Clear
            </button>
          </div>
        </div>
      </Card>

      {/* Ledger Table */}
      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#172033' }}>
                {['Date', 'Particulars', 'Category', 'Reference', 'Debit', 'Credit', 'Balance', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-white">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withBalance.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#8A8A8A]">No entries found. Add your first ledger entry.</td></tr>
              ) : (
                <>
                  {withBalance.map((entry, idx) => (
                    <tr key={entry.id} className={`border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'} hover:bg-[#FFF7F7]`}>
                      <td className="px-4 py-3 text-sm text-[#4A4A4A] whitespace-nowrap">{entry.entry_date}</td>
                      <td className="px-4 py-3 text-sm font-medium text-[#172033] max-w-[200px]">
                        <div className="truncate" title={entry.particulars}>{entry.particulars}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8A8A8A]">{entry.category || '—'}</td>
                      <td className="px-4 py-3 text-xs text-[#8A8A8A]">{entry.reference || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#DC2626]">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#16A34A]">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold whitespace-nowrap"
                        style={{ color: entry.balance >= 0 ? '#16A34A' : '#DC2626' }}>
                        {formatCurrency(Math.abs(entry.balance))}
                        <span className="ml-1 text-[10px] font-normal text-[#8A8A8A]">
                          {entry.balance >= 0 ? 'Cr' : 'Dr'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => setViewEntry(entry)}
                            className="rounded bg-[#2AA0D3] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#2289b5]">
                            View
                          </button>
                          <button onClick={() => handleDelete(entry.id, entry.particulars)}
                            disabled={deletingId === entry.id}
                            className="rounded border border-[#DC2626] px-2.5 py-1 text-xs font-semibold text-[#DC2626] hover:bg-[#FFE5E5] disabled:opacity-50">
                            {deletingId === entry.id ? '...' : 'Del'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="border-t-2 border-[#172033] bg-[#F5F6F7]">
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-[#172033]">TOTAL</td>
                    <td className="px-4 py-3 text-sm font-bold text-[#DC2626]">{formatCurrency(totals.debit)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{formatCurrency(totals.credit)}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: totals.credit - totals.debit >= 0 ? '#16A34A' : '#DC2626' }}>
                      {formatCurrency(Math.abs(totals.credit - totals.debit))}
                      <span className="ml-1 text-[10px] font-normal text-[#8A8A8A]">
                        {totals.credit - totals.debit >= 0 ? 'Cr' : 'Dr'}
                      </span>
                    </td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg border-0 shadow-2xl p-6 bg-white max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">Add Ledger Entry</h3>
              <button onClick={() => setShowForm(false)} className="text-[#8A8A8A] hover:text-[#344054] text-xl">✕</button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.entryDate} onChange={(e) => setForm((p) => ({ ...p, entryDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Particulars <span className="text-red-500">*</span></label>
                <input value={form.particulars} onChange={(e) => setForm((p) => ({ ...p, particulars: e.target.value }))}
                  placeholder="Description of the transaction"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#DC2626]">Debit (Expenditure)</label>
                  <input type="number" value={form.debit}
                    onChange={(e) => setForm((p) => ({ ...p, debit: e.target.value, credit: e.target.value ? '' : p.credit }))}
                    placeholder="0.00" min="0"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#16A34A]">Credit (Income)</label>
                  <input type="number" value={form.credit}
                    onChange={(e) => setForm((p) => ({ ...p, credit: e.target.value, debit: e.target.value ? '' : p.debit }))}
                    placeholder="0.00" min="0"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium">Category</label>
                  <button onClick={() => { setShowCatManager(true); setCatError(null); }}
                    className="text-xs text-[#FF3B3B] hover:underline font-medium">
                    + Manage Categories
                  </button>
                </div>
                <CategorySelect value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))} className="w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Reference No.</label>
                <input value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                  placeholder="e.g. SIIF-RCPT-2026-00001"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2} placeholder="Optional additional notes"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 rounded-lg bg-[#FF3B3B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Entry'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="rounded-lg border border-[#E3E7EE] px-4 py-2.5 text-sm font-semibold text-[#344054]">
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* View Entry Modal */}
      {viewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl p-6 bg-white">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">Entry Details</h3>
              <button onClick={() => setViewEntry(null)} className="text-[#8A8A8A] hover:text-[#344054] text-xl">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Date', viewEntry.entry_date],
                ['Particulars', viewEntry.particulars],
                ['Category', viewEntry.category || '—'],
                ['Reference', viewEntry.reference || '—'],
                ['Debit', viewEntry.debit > 0 ? formatCurrency(viewEntry.debit) : '—'],
                ['Credit', viewEntry.credit > 0 ? formatCurrency(viewEntry.credit) : '—'],
                ['Notes', viewEntry.notes || '—'],
                ['Entered By', viewEntry.entered_by || '—'],
                ['Created At', new Date(viewEntry.created_at).toLocaleString('en-IN')],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <span className="w-28 shrink-0 font-semibold text-[#4A4A4A]">{label}:</span>
                  <span className={`text-[#667085] ${label === 'Debit' && viewEntry.debit > 0 ? 'font-bold text-[#DC2626]' : ''} ${label === 'Credit' && viewEntry.credit > 0 ? 'font-bold text-[#16A34A]' : ''}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => handleDelete(viewEntry.id, viewEntry.particulars)}
                disabled={deletingId === viewEntry.id}
                className="flex-1 rounded-lg border border-[#DC2626] px-4 py-2 text-sm font-semibold text-[#DC2626] hover:bg-[#FFE5E5] disabled:opacity-50">
                {deletingId === viewEntry.id ? 'Deleting...' : 'Delete Entry'}
              </button>
              <button onClick={() => setViewEntry(null)}
                className="flex-1 rounded-lg bg-[#172033] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F172A]">
                Close
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Opening Balance Modal */}
      {showOpeningBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl p-6 bg-white">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">Set Opening Balance</h3>
              <button onClick={() => setShowOpeningBalance(false)} className="text-[#8A8A8A] hover:text-[#344054] text-xl">✕</button>
            </div>
            <p className="mb-4 text-sm text-[#667085]">
              The opening balance will be added as the first entry in your ledger. Use <strong>Credit</strong> if you are starting with funds available (surplus), or <strong>Debit</strong> if starting with a liability.
            </p>
            {obError && <div className="mb-3 rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">{obError}</div>}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">As of Date</label>
                <input type="date" value={obForm.date}
                  onChange={(e) => setObForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Opening Amount (₹)</label>
                <input type="number" value={obForm.amount}
                  onChange={(e) => setObForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="e.g. 50000" min="0"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <div className="flex gap-3">
                  {(['credit', 'debit'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value={t} checked={obForm.type === t}
                        onChange={() => setObForm((p) => ({ ...p, type: t }))}
                        className="accent-[#FF3B3B]" />
                      <span className={`text-sm font-semibold ${t === 'credit' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                        {t === 'credit' ? 'Credit (Surplus / Available Funds)' : 'Debit (Opening Liability)'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={handleSaveOpeningBalance} disabled={obSaving}
                className="flex-1 rounded-lg bg-[#FF3B3B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {obSaving ? 'Saving...' : 'Save Opening Balance'}
              </button>
              <button onClick={() => setShowOpeningBalance(false)}
                className="rounded-lg border border-[#E3E7EE] px-4 py-2.5 text-sm font-semibold text-[#344054]">
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCatManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl p-6 bg-white max-h-[80vh] flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">Manage Categories</h3>
              <button onClick={() => setShowCatManager(false)} className="text-[#8A8A8A] hover:text-[#344054] text-xl">✕</button>
            </div>

            {catError && <div className="mb-3 rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">{catError}</div>}

            {/* Add new category */}
            <div className="mb-4 flex gap-2">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder="New category name..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm"
              />
              <button onClick={handleAddCategory} disabled={catSaving}
                className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap">
                {catSaving ? '...' : '+ Add'}
              </button>
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {categories.length === 0 ? (
                <p className="py-4 text-center text-sm text-[#8A8A8A]">No categories yet.</p>
              ) : categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between rounded-lg border border-[#E3E7EE] bg-[#F8FAFC] px-4 py-2.5">
                  <span className="text-sm font-medium text-[#344054]">{cat.name}</span>
                  <button onClick={() => handleDeleteCategory(cat)}
                    disabled={deletingCatId === cat.id}
                    className="text-xs font-semibold text-[#DC2626] hover:underline disabled:opacity-50">
                    {deletingCatId === cat.id ? '...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>

            <button onClick={() => setShowCatManager(false)}
              className="mt-4 w-full rounded-lg bg-[#172033] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F172A]">
              Done
            </button>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
