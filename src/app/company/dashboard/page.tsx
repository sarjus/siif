'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import CompanyShell from '@/components/CompanyShell';
import { Bell, CalendarClock, CheckCircle2, CreditCard, IndianRupee, WalletCards, type LucideIcon } from 'lucide-react';
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
          headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
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

  const activeCompany = applications[0];

  return (
    <CompanyShell
      title="Company Dashboard"
      subtitle="Track fee dues, deposits, notifications, and approved application details."
      companyName={activeCompany?.business_name || activeCompany?.email}
      onLogout={handleLogout}
    >
        {error && (
          <div className="mb-6 rounded-lg border border-[#FFC9C9] bg-[#FFF1F1] p-4 text-sm font-medium text-[#B42318]">
            {error}
          </div>
        )}

        {dashboardNotice && (
          <div className="mb-6 rounded-lg p-4 text-sm font-semibold text-white" style={{ backgroundColor: dashboardNotice.color }}>
            {dashboardNotice.text}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {([
            ['Monthly Fee', formatCurrency(feeSummary.monthlyFee), '#FF3B3B', IndianRupee],
            ['Outstanding Dues', formatCurrency(feeSummary.outstandingAmount), '#DC2626', CreditCard],
            ['Overdue Invoices', String(feeSummary.overdueInvoices), '#F59E0B', CalendarClock],
            ['Deposit Balance', formatCurrency(feeSummary.depositBalance), '#2AA0D3', WalletCards],
          ] as Array<[string, string, string, LucideIcon]>).map(([label, value, color, Icon]) => (
            <Card key={String(label)} className="rounded-lg border border-[#E3E7EE] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">{label}</p>
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                </div>
                <span className="rounded-lg bg-[#F4F6F8] p-2" style={{ color }}>
                  <Icon className="size-5" />
                </span>
              </div>
            </Card>
          ))}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <div className="grid grid-cols-1 gap-4">
          {applications.map((app) => (
            <Card key={app.id} className="rounded-lg border border-[#E3E7EE] bg-white p-6 shadow-sm">
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
              <h2 className="mt-2 text-2xl font-bold" style={{ color: '#0F172A' }}>
                {app.business_name || 'Company'}
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-[#475569] md:grid-cols-2">
                <p><span className="font-semibold text-[#172033]">Lead Entrepreneur:</span> {app.lead_name || '-'}</p>
                <p><span className="font-semibold text-[#172033]">Application Email:</span> {app.email}</p>
                <p>
                  <span className="font-semibold text-[#172033]">Status:</span>{' '}
                  <span className="font-bold text-[#16A34A]">{app.status.replace(/_/g, ' ')}</span>
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Last updated:</span>{' '}
                  {new Date(app.updated_at || app.submitted_at || new Date().toISOString()).toLocaleString()}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#E3E7EE] pt-5">
                <a
                  href="/company/payments"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#FF3B3B] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700"
                >
                  <CreditCard className="size-4" />
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

          <Card className="rounded-lg border border-[#E3E7EE] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Bell className="size-5 text-[#FF3B3B]" />
              <h3 className="text-lg font-bold text-[#172033]">Recent Notifications</h3>
            </div>
            {recentNotifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-sm text-[#667085]">
                <CheckCircle2 className="mb-2 size-5 text-[#16A34A]" />
                No notifications available.
              </div>
            ) : (
              <div className="space-y-3">
                {recentNotifications.map((notification) => (
                  <div key={notification.id} className="rounded-lg border border-[#E3E7EE] bg-[#FAFAFA] p-4">
                    <p className="text-sm font-bold text-[#344054]">{notification.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#667085]">{notification.message}</p>
                    <p className="mt-2 text-xs text-[#8A8A8A]">
                      {new Date(notification.sent_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
    </CompanyShell>
  );
}
