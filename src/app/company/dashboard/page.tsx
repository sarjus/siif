'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { DEPOSIT_STATUS_COLORS, formatCurrency, INVOICE_STATUS_COLORS } from '@/lib/fee-management';

interface CompanyApplication {
  id: string;
  business_name: string | null;
  lead_name: string | null;
  email: string;
  status: string;
  updated_at: string | null;
  submitted_at: string | null;
}

export default function CompanyDashboardPage() {
  const router = useRouter();

  const [applications, setApplications] = useState<CompanyApplication[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<
    Array<{ id: string; title: string; message: string; sent_at: string }>
  >([]);
  const [feeSummary, setFeeSummary] = useState({
    monthlyFee: 0,
    outstandingAmount: 0,
    overdueInvoices: 0,
    depositBalance: 0,
    depositStatus: null as string | null,
    depositAmountRefunded: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }

      const user = session.user;
      const userEmail = (user.email || '').trim().toLowerCase();
      if (!userEmail) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      if (String(user.user_metadata?.role || '') !== 'company') {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      if (user.user_metadata?.must_reset_password === true) {
        router.push('/login?reset=1');
        return;
      }

      const { data, error: appError } = await supabase
        .from('applications')
        .select('id, business_name, lead_name, email, status, updated_at, submitted_at')
        .ilike('email', userEmail)
        .eq('status', 'approved')
        .order('updated_at', { ascending: false });

      if (appError) throw appError;

      if (!data || data.length === 0) {
        await supabase.auth.signOut();
        setError('Access denied. Your company account is active only for approved applications.');
        router.push('/login');
        return;
      }

      setApplications(data);

      const latestApplication = data[0];
      if (latestApplication) {
        await fetch('/api/admin/fee-management/sync-invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: latestApplication.id }),
        });

        const [
          { data: settingData },
          { data: depositData },
          { data: invoiceData },
          { data: notificationsData },
        ] = await Promise.all([
          supabase
            .from('incubation_fee_settings')
            .select('monthly_fee')
            .eq('company_id', latestApplication.id)
            .maybeSingle(),
          supabase
            .from('company_deposits')
            .select('balance_amount, status, amount_refunded')
            .eq('company_id', latestApplication.id)
            .maybeSingle(),
          supabase
            .from('incubation_fee_invoices')
            .select('amount, amount_paid, status')
            .eq('company_id', latestApplication.id),
          supabase
            .from('notifications')
            .select('id, title, message, sent_at')
            .eq('company_id', latestApplication.id)
            .order('sent_at', { ascending: false })
            .limit(5),
        ]);

        const outstandingAmount = (invoiceData || []).reduce(
          (sum, invoice) => sum + Math.max(Number(invoice.amount || 0) - Number(invoice.amount_paid || 0), 0),
          0
        );

        setFeeSummary({
          monthlyFee: Number(settingData?.monthly_fee || 0),
          outstandingAmount,
          overdueInvoices: (invoiceData || []).filter((invoice) => invoice.status === 'overdue').length,
          depositBalance: Number(depositData?.balance_amount || 0),
          depositStatus: depositData?.status || null,
          depositAmountRefunded: Number(depositData?.amount_refunded || 0),
        });

        setRecentNotifications((notificationsData || []) as Array<{ id: string; title: string; message: string; sent_at: string }>);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company dashboard');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const dashboardNotice = useMemo(() => {
    if (feeSummary.overdueInvoices > 0) {
      return {
        text: `You have ${feeSummary.overdueInvoices} overdue fee invoice${feeSummary.overdueInvoices > 1 ? 's' : ''}.`,
        color: '#DC2626',
      };
    }

    if (feeSummary.outstandingAmount > 0) {
      return {
        text: 'There are pending fee dues awaiting payment.',
        color: '#F59E0B',
      };
    }

    if (feeSummary.depositStatus === 'pending') {
      return {
        text: 'Your refundable deposit is still pending.',
        color: '#2AA0D3',
      };
    }

    return null;
  }, [feeSummary.depositStatus, feeSummary.outstandingAmount, feeSummary.overdueInvoices]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}>
      <div className="bg-[#0F172A] p-6 border-b border-slate-700">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Company Dashboard</h1>
            <p style={{ color: '#CBD5E1', fontSize: '14px', marginTop: '4px' }}>
              Welcome to your SIIF company portal
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-700 transition-all text-sm font-semibold"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 rounded-lg text-sm" style={{ backgroundColor: '#FFE5E5', color: '#D32F2F' }}>
            {error}
          </div>
        )}

        {dashboardNotice && (
          <div className="mb-6 p-4 rounded-lg text-sm text-white" style={{ backgroundColor: dashboardNotice.color }}>
            {dashboardNotice.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            ['Monthly Fee', formatCurrency(feeSummary.monthlyFee), '#FF3B3B'],
            ['Outstanding Dues', formatCurrency(feeSummary.outstandingAmount), '#DC2626'],
            ['Overdue Invoices', String(feeSummary.overdueInvoices), '#F59E0B'],
            ['Deposit Balance', formatCurrency(feeSummary.depositBalance), '#2AA0D3'],
          ].map(([label, value, color]) => (
            <Card key={label} className="border-0 shadow p-5">
              <p className="mb-1 text-xs font-semibold uppercase text-[#8A8A8A]">{label}</p>
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            </Card>
          ))}
        </div>

        <Card className="border-0 shadow p-6 mb-6">
          <h3 className="text-lg font-bold mb-4" style={{ color: '#FF3B3B' }}>
            Recent Notifications
          </h3>
          {recentNotifications.length === 0 ? (
            <p className="text-sm text-[#8A8A8A]">No notifications available.</p>
          ) : (
            <div className="space-y-3">
              {recentNotifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border border-gray-200 p-4 bg-[#FAFAFA]">
                  <p className="text-sm font-semibold text-[#4A4A4A]">{notification.title}</p>
                  <p className="mt-1 text-sm text-[#666666]">{notification.message}</p>
                  <p className="mt-2 text-xs text-[#8A8A8A]">
                    {new Date(notification.sent_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4">
          {applications.map((app) => (
            <Card key={app.id} className="border-0 shadow p-6">
              <p
                style={{
                  fontSize: '12px',
                  color: '#8A8A8A',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                }}
              >
                Approved Application
              </p>
              <h2 className="text-2xl font-bold mt-2" style={{ color: '#0F172A' }}>
                {app.business_name || 'Company'}
              </h2>
              <p style={{ marginTop: '8px', color: '#475569', fontSize: '14px' }}>
                Lead Entrepreneur: {app.lead_name || '-'}
              </p>
              <p style={{ marginTop: '4px', color: '#475569', fontSize: '14px' }}>Application Email: {app.email}</p>
              <p style={{ marginTop: '4px', color: '#475569', fontSize: '14px' }}>
                Status: <span style={{ color: '#16A34A', fontWeight: 700 }}>{app.status}</span>
              </p>
              <p style={{ marginTop: '4px', color: '#64748B', fontSize: '13px' }}>
                Last updated:{' '}
                {new Date(app.updated_at || app.submitted_at || new Date().toISOString()).toLocaleString()}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="/company/payments"
                  className="rounded-lg bg-[#FF3B3B] px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-all"
                >
                  View Payment History
                </a>
                {feeSummary.depositAmountRefunded > 0 && feeSummary.depositStatus && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: DEPOSIT_STATUS_COLORS[feeSummary.depositStatus as keyof typeof DEPOSIT_STATUS_COLORS] || '#64748B' }}
                  >
                    Deposit {feeSummary.depositStatus.replace(/_/g, ' ')}
                  </span>
                )}
                {feeSummary.overdueInvoices > 0 && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: INVOICE_STATUS_COLORS.overdue }}
                  >
                    Payment Attention Required
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
