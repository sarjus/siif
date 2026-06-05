'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReceiptPdf, formatBillingMonth, formatCurrency } from '@/lib/fee-management';

export default function ReceiptsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [collections, setCollections] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');

      const response = await fetch('/api/admin/fee-management/receipts-data', {
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load receipts');
      }

      setCollections(payload.collections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  // Sort by receipt number (SIIF-RCPT-2026-00001 → sequential ascending)
  // then apply search + type filter
  const filtered = useMemo(() => {
    const sorted = [...collections].sort((a, b) => {
      const an = String(a.receipt_number || '');
      const bn = String(b.receipt_number || '');
      return an.localeCompare(bn, undefined, { numeric: true });
    });

    const q = search.trim().toLowerCase();

    return sorted.filter((col) => {
      const matchesType = typeFilter === 'all' || col.collection_type === typeFilter;
      if (!q) return matchesType;
      const matchesSearch =
        String(col.receipt_number || '').toLowerCase().includes(q) ||
        String(col.applications?.business_name || '').toLowerCase().includes(q) ||
        String(col.applications?.email || '').toLowerCase().includes(q) ||
        String(col.transaction_reference || '').toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [collections, search, typeFilter]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDownload = async (collection: any) => {
    let logoDataUrl: string | undefined;
    try {
      const img = new Image();
      img.src = '/assets/SIIF Logo.png';
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
      if (img.naturalWidth) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
        logoDataUrl = canvas.toDataURL('image/png');
      }
    } catch {
      // proceed without logo
    }

    downloadReceiptPdf({
      receiptNumber: collection.receipt_number,
      receiptDate: collection.collection_date,
      companyName: collection.applications?.business_name || collection.applications?.email || 'Company',
      collectionType: String(collection.collection_type || '').replace(/_/g, ' '),
      invoiceNumber: collection.incubation_fee_invoices?.invoice_number || null,
      billingMonth: collection.incubation_fee_invoices?.billing_month
        ? formatBillingMonth(collection.incubation_fee_invoices.billing_month)
        : null,
      depositReference: collection.deposit_id || null,
      amountPaid: collection.amount_collected,
      paymentMode: String(collection.payment_mode || '').replace(/_/g, ' '),
      transactionReference: collection.transaction_reference || null,
      receivedBy: collection.collected_by || null,
      logoDataUrl,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Receipts" subtitle="Download, print, and reprint payment receipts" userEmail={userEmail} onLogout={handleLogout}>
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}

      {/* Search + Filter — same style as invoice page */}
      <Card className="border-0 shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search receipt number, company, email or reference"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            <option value="all">All Types</option>
            <option value="monthly_fee">Monthly Fee</option>
            <option value="refundable_deposit">Refundable Deposit</option>
            <option value="additional_charges">Additional Charges</option>
            <option value="penalty_charges">Penalty Charges</option>
            <option value="other_fees">Other Fees</option>
            <option value="deposit_refund">Deposit Refund</option>
          </select>
        </div>
      </Card>

      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F5F6F7' }}>
                {['Receipt', 'Company', 'Type', 'Billing Month', 'Amount', 'Date', 'Action'].map((heading) => (
                  <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">
                    {search || typeFilter !== 'all' ? 'No receipts match your search.' : 'No receipts found.'}
                  </td>
                </tr>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                filtered.map((collection: any) => (
                  <tr key={collection.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{collection.receipt_number}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">
                      <div className="font-semibold">{collection.applications?.business_name || 'Company'}</div>
                      <div className="text-xs text-[#8A8A8A]">{collection.applications?.email || ''}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A] capitalize">
                      {String(collection.collection_type || '').replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">
                      {collection.incubation_fee_invoices?.billing_month
                        ? formatBillingMonth(collection.incubation_fee_invoices.billing_month)
                        : '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(collection.amount_collected)}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.collection_date}</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleDownload(collection)}
                        className="rounded-lg bg-[#2AA0D3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2289b5]"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
