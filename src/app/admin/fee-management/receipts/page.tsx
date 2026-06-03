'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const handleDownload = async (collection: Record<string, unknown & { applications?: { business_name?: string; email?: string } }>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const col = collection as any;
    // Try to load SIIF logo
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
      // logo load failed — proceed without it
    }

    downloadReceiptPdf({
      receiptNumber: col.receipt_number,
      receiptDate: col.collection_date,
      companyName: col.applications?.business_name || col.applications?.email || 'Company',
      collectionType: String(col.collection_type || '').replace(/_/g, ' '),
      invoiceNumber: col.incubation_fee_invoices?.invoice_number || null,
      billingMonth: col.incubation_fee_invoices?.billing_month
        ? formatBillingMonth(col.incubation_fee_invoices.billing_month)
        : null,
      depositReference: col.deposit_id || null,
      amountPaid: col.amount_collected,
      paymentMode: String(col.payment_mode || '').replace(/_/g, ' '),
      transactionReference: col.transaction_reference || null,
      receivedBy: col.collected_by || null,
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
              {collections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No receipts found.</td>
                </tr>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                collections.map((collection: any) => (
                  <tr key={collection.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{collection.receipt_number}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">
                      <div className="font-semibold">{collection.applications?.business_name || 'Company'}</div>
                      <div className="text-xs text-[#8A8A8A]">{collection.applications?.email || ''}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A] capitalize">{String(collection.collection_type || '').replace(/_/g, ' ')}</td>
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
