'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReceiptPdf, formatBillingMonth, formatCurrency } from '@/lib/fee-management';

export default function ReceiptsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    const session = await getSafeSession();
    if (!session) {
      router.push('/login');
      return;
    }
    setUserEmail(session.user.email || '');
    const { data } = await supabase
      .from('fee_collections')
      .select('*, applications(business_name, email), incubation_fee_invoices(invoice_number, billing_month)')
      .order('collection_date', { ascending: false });
    setCollections(data || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Receipts" subtitle="Download, print, and reprint payment receipts" userEmail={userEmail} onLogout={handleLogout}>
      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F5F6F7' }}>
                {['Receipt', 'Company', 'Type', 'Billing Month', 'Amount', 'Date', 'Action'].map((heading) => <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id} className="border-t border-gray-200">
                  <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">{collection.receipt_number}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.applications?.business_name || collection.applications?.email || '-'}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.collection_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.incubation_fee_invoices?.billing_month ? formatBillingMonth(collection.incubation_fee_invoices.billing_month) : '-'}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(collection.amount_collected)}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{collection.collection_date}</td>
                  <td className="px-4 py-4">
                    <button onClick={() => downloadReceiptPdf({ receiptNumber: collection.receipt_number, receiptDate: collection.collection_date, companyName: collection.applications?.business_name || collection.applications?.email || 'Company', collectionType: collection.collection_type.replace(/_/g, ' '), invoiceNumber: collection.incubation_fee_invoices?.invoice_number || null, billingMonth: collection.incubation_fee_invoices?.billing_month ? formatBillingMonth(collection.incubation_fee_invoices.billing_month) : null, depositReference: collection.deposit_id, amountPaid: collection.amount_collected, paymentMode: collection.payment_mode.replace(/_/g, ' '), transactionReference: collection.transaction_reference || null, receivedBy: collection.collected_by || null })} className="rounded-lg bg-[#2AA0D3] px-4 py-2 text-white font-semibold">Download Receipt</button>
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
