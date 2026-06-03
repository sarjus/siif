'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';

import { Card } from '@/components/ui/card';
import AdminShell from '@/components/AdminShell';
import { formatCurrency } from '@/lib/fee-management';

export default function FeeManagementOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [runningCycle, setRunningCycle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [stats, setStats] = useState({
    totalMonthlyCollection: 0,
    totalDepositsCollected: 0,
    pendingFees: 0,
    pendingDeposits: 0,
    overdueFees: 0,
    recentPayments: 0,
    upcomingDuePayments: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');

      const response = await fetch('/api/admin/fee-management/overview', {
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load fee management overview');
      }

      setStats(payload.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fee management overview');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleRunMonthlyCycle = async () => {
    setRunningCycle(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/fee-management/run-monthly-cycle', {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to run monthly cycle');
      }

      setNotice(
        `Monthly cycle completed. Invoices created: ${payload.created}, dashboard notifications: ${payload.notificationsCreated}, emails sent: ${payload.emailsSent}.`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run monthly cycle');
    } finally {
      setRunningCycle(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <AdminShell
      title="Fee Management"
      subtitle="Overview of collections, dues, deposits, and upcoming payments"
      userEmail={userEmail}
      onLogout={handleLogout}
      headerActions={
        <button
          onClick={handleRunMonthlyCycle}
          disabled={runningCycle}
          className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {runningCycle ? 'Running Monthly Cycle...' : 'Run Monthly Cycle Now'}
        </button>
      }
    >
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-6 rounded-lg bg-[#EAF9F0] p-4 text-sm text-[#1E7F46]">{notice}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          ['Total Monthly Collection', formatCurrency(stats.totalMonthlyCollection), '#FF3B3B'],
          ['Total Deposits Collected', formatCurrency(stats.totalDepositsCollected), '#16A34A'],
          ['Pending Fees', String(stats.pendingFees), '#F59E0B'],
          ['Pending Deposits', String(stats.pendingDeposits), '#2AA0D3'],
          ['Overdue Fees', String(stats.overdueFees), '#DC2626'],
          ['Recent Payments', String(stats.recentPayments), '#7C3AED'],
          ['Upcoming Due Payments', String(stats.upcomingDuePayments), '#0EA5A0'],
        ].map(([label, value, color]) => (
          <Card key={label} className="border-0 shadow p-5">
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#8A8A8A', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow p-6">
        <h3 className="text-xl font-bold mb-3" style={{ color: '#FF3B3B' }}>Module Sections</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[
            ['Fee Configuration', '/admin/fee-management/configuration'],
            ['Monthly Invoices', '/admin/fee-management/invoices'],
            ['Record Payment', '/admin/fee-management/payments'],
            ['Record Deposit', '/admin/fee-management/deposits'],
            ['Transactions', '/admin/fee-management/transactions'],
            ['Receipts', '/admin/fee-management/receipts'],
            ['Notifications', '/admin/fee-management/notifications'],
            ['Reports', '/admin/fee-management/reports'],
            ['Payment Submissions', '/admin/fee-management/payment-submissions'],
          ].map(([label, href]) => (
            <a key={href} href={href} className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-4 hover:border-[#FF3B3B] hover:bg-white transition-all" style={{ color: '#4A4A4A', fontWeight: 600 }}>
              {label}
            </a>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
