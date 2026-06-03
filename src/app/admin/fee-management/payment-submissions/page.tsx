'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReceiptPdf, formatBillingMonth, formatCurrency } from '@/lib/fee-management';

type Submission = {
  id: string;
  company_id: string;
  invoice_id: string | null;
  amount_paid: number;
  payment_mode: string;
  transaction_reference: string | null;
  payment_date: string;
  remarks: string | null;
  status: 'pending' | 'approved' | 'rejected';
  receipt_number: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  applications: { business_name: string | null; email: string } | null;
  incubation_fee_invoices: {
    invoice_number: string | null;
    billing_month: string | null;
    amount: number | null;
    amount_paid: number | null;
    due_date: string | null;
    status: string | null;
  } | null;
};

const STATUS_COLORS = {
  pending: '#F59E0B',
  approved: '#16A34A',
  rejected: '#DC2626',
};

export default function PaymentSubmissionsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');

      const response = await fetch('/api/admin/fee-management/payment-submissions', {
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to load submissions');
      setSubmissions((payload.submissions || []) as Submission[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async (submission: Submission, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? 'Approve & generate receipt' : 'Reject';
    const confirmed = window.confirm(`${label} payment of ${formatCurrency(submission.amount_paid)} from ${submission.applications?.business_name || submission.applications?.email}?`);
    if (!confirmed) return;

    setProcessingId(submission.id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/fee-management/payment-submissions', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submission.id, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to process submission');

      if (action === 'approve' && payload.receipt) {
        setNotice(`Payment approved. Receipt ${payload.receipt.receiptNumber} generated.`);
        // Auto-download receipt
        downloadReceiptPdf({
          receiptNumber: payload.receipt.receiptNumber,
          receiptDate: payload.receipt.receiptDate,
          companyName: payload.receipt.companyName,
          collectionType: payload.receipt.collectionType,
          invoiceNumber: payload.receipt.invoiceNumber,
          billingMonth: payload.receipt.billingMonth
            ? formatBillingMonth(payload.receipt.billingMonth)
            : null,
          amountPaid: payload.receipt.amountPaid,
          paymentMode: payload.receipt.paymentMode,
          transactionReference: payload.receipt.transactionReference,
          receivedBy: payload.receipt.receivedBy,
        });
      } else {
        setNotice('Submission rejected.');
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process');
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const filtered = submissions.filter((s) => statusFilter === 'all' || s.status === statusFilter);
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell
      title="Payment Submissions"
      subtitle="Review and verify payment details submitted by companies"
      userEmail={userEmail}
      onLogout={handleLogout}
    >
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-6 rounded-lg bg-[#EAF9F0] p-4 text-sm text-[#1E7F46]">{notice}</div>}

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          ['Total Submissions', String(submissions.length), '#4A4A4A'],
          ['Pending Verification', String(pendingCount), '#F59E0B'],
          ['Approved', String(submissions.filter((s) => s.status === 'approved').length), '#16A34A'],
        ].map(([label, value, color]) => (
          <Card key={label} className="border-0 shadow p-5">
            <p className="mb-1 text-xs font-semibold uppercase text-[#8A8A8A]">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-3">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              statusFilter === s
                ? 'bg-[#FF3B3B] text-white'
                : 'border border-gray-300 text-[#4A4A4A] hover:border-[#FF3B3B]'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F5F6F7' }}>
                {['Company', 'Invoice', 'Amount', 'Mode', 'UTR / Reference', 'Date', 'Remarks', 'Status', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">
                    No {statusFilter === 'all' ? '' : statusFilter} submissions found.
                  </td>
                </tr>
              ) : filtered.map((sub) => (
                <tr key={sub.id} className="border-t border-gray-100">
                  <td className="px-4 py-4">
                    <p className="text-sm font-semibold text-[#4A4A4A]">
                      {sub.applications?.business_name || 'Company'}
                    </p>
                    <p className="text-xs text-[#8A8A8A]">{sub.applications?.email}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">
                    {sub.incubation_fee_invoices?.invoice_number
                      ? <>
                          <p className="font-medium">{sub.incubation_fee_invoices.invoice_number}</p>
                          {sub.incubation_fee_invoices.billing_month && (
                            <p className="text-xs text-[#8A8A8A]">{formatBillingMonth(sub.incubation_fee_invoices.billing_month)}</p>
                          )}
                        </>
                      : <span className="text-[#8A8A8A]">—</span>
                    }
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-[#4A4A4A]">
                    {formatCurrency(sub.amount_paid)}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">
                    {sub.payment_mode.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">
                    {sub.transaction_reference || <span className="text-[#8A8A8A]">—</span>}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A]">{sub.payment_date}</td>
                  <td className="px-4 py-4 text-sm text-[#4A4A4A] max-w-[160px]">
                    <span className="line-clamp-2">{sub.remarks || <span className="text-[#8A8A8A]">—</span>}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                      style={{ backgroundColor: STATUS_COLORS[sub.status] }}
                    >
                      {sub.status}
                    </span>
                    {sub.receipt_number && (
                      <p className="mt-1 text-[11px] text-[#8A8A8A]">{sub.receipt_number}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {sub.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(sub, 'approve')}
                          disabled={processingId === sub.id}
                          className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {processingId === sub.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleAction(sub, 'reject')}
                          disabled={processingId === sub.id}
                          className="rounded-lg border border-[#DC2626] px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-[#DC2626] hover:text-white disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : sub.status === 'approved' ? (
                      <button
                        onClick={() => downloadReceiptPdf({
                          receiptNumber: sub.receipt_number || '',
                          receiptDate: sub.payment_date,
                          companyName: sub.applications?.business_name || sub.applications?.email || 'Company',
                          collectionType: sub.incubation_fee_invoices ? 'Monthly Incubation Fee' : 'Other Fees',
                          invoiceNumber: sub.incubation_fee_invoices?.invoice_number || null,
                          billingMonth: sub.incubation_fee_invoices?.billing_month
                            ? formatBillingMonth(sub.incubation_fee_invoices.billing_month)
                            : null,
                          amountPaid: sub.amount_paid,
                          paymentMode: sub.payment_mode.replace(/_/g, ' '),
                          transactionReference: sub.transaction_reference || null,
                          receivedBy: sub.reviewed_by || 'Admin',
                        })}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2AA0D3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2289b5]"
                      >
                        Receipt
                      </button>
                    ) : (
                      <span className="text-xs text-[#8A8A8A]">Rejected</span>
                    )}
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
