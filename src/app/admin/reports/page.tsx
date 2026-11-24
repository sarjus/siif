'use client';

import { FeedbackIcon } from '@/components/icons/feedback';
import { ActionIcon, DashboardIcon, ModuleIcon, type DashboardArtwork, type IconPalette } from '@/components/icons/icon';

import { useEffect, useState } from 'react';
import { database, getSafeSession, getAuthHeaders } from '@/lib/database';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/fee-management';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CircleDollarSign,
  TrendingDown,
  type LucideIcon,
} from '@/components/icons/glyphs';

const reports = [
  {
    label: 'Collection Report',
    description: 'All fee payments received — monthly fees and deposits',
    href: '/admin/reports/collection',
    artwork: 'transactions',
    palette: 'finance',
    color: '#16A34A',
  },
  {
    label: 'Outstanding Report',
    description: 'Unpaid and partially paid invoices with balances due',
    href: '/admin/reports/outstanding',
    artwork: 'receipts',
    palette: 'payments',
    color: '#DC2626',
  },
  {
    label: 'Deposit Report',
    description: 'Refundable security deposits — collected, refunded, balance',
    href: '/admin/reports/deposits',
    artwork: 'deposits',
    palette: 'finance',
    color: '#2AA0D3',
  },
  {
    label: 'Staff Payments Report',
    description: 'Salary and honorarium disbursements to staff',
    href: '/admin/reports/staff-payments',
    artwork: 'staff-payments',
    palette: 'finance',
    color: '#7C3AED',
  },
  {
    label: 'Ledger Report',
    description: 'Full general ledger with running debit/credit balance',
    href: '/admin/reports/ledger',
    artwork: 'ledger',
    palette: 'documents',
    color: '#0F766E',
  },
  {
    label: 'Invoice Report',
    description: 'All invoices generated — status, amounts, billing months',
    href: '/admin/reports/invoices',
    artwork: 'invoices',
    palette: 'payments',
    color: '#1D4ED8',
  },
] satisfies Array<{ label: string; description: string; href: string; artwork: DashboardArtwork; palette: IconPalette; color: string }>;

type ReportStats = { totalIncome: number; totalOutstanding: number; totalStaffPaid: number; netBalance: number };

export default function ReportsHubPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');

      try {
        const headers = await getAuthHeaders();
        const [reportsRes, staffRes] = await Promise.all([
          fetch('/api/admin/fee-management/reports', { headers }),
          fetch('/api/admin/staff/payments', { headers }),
        ]);

        const [reports, staff] = await Promise.all([reportsRes.json(), staffRes.json()]);
        if (!reportsRes.ok) throw new Error(reports.error || 'Report records are unavailable.');
        if (!staffRes.ok) throw new Error(staff.error || 'Staff payment records are unavailable.');

        const totalIncome = (reports.collections || []).reduce((s: number, c: { amount_collected: number }) => s + Number(c.amount_collected || 0), 0);
        const totalOutstanding = (reports.invoices || []).filter((i: { status: string }) => i.status !== 'paid').reduce((s: number, i: { amount: number; amount_paid: number }) => s + Math.max(Number(i.amount || 0) - Number(i.amount_paid || 0), 0), 0);
        const totalStaffPaid = (staff.payments || []).reduce((s: number, p: { amount: number }) => s + Number(p.amount || 0), 0);
        setStats({ totalIncome, totalOutstanding, totalStaffPaid, netBalance: totalIncome - totalStaffPaid });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Please refresh the page to try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const handleLogout = async () => { await database.auth.signOut(); router.push('/login'); };
  if (loading) return <div className="min-h-screen flex items-center justify-center"><FeedbackIcon kind="loading" />Loading...</div>;

  return (
    <AdminShell title="Reports" subtitle="Financial and operational reports with export options" userEmail={userEmail} onLogout={handleLogout}>
      {/* Summary strip */}
      {error && <p role="alert" className="mb-8 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#B42318]"><FeedbackIcon kind="error" />Report totals couldn’t load. {error}</p>}
      {stats && <div className="mb-8 grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {([
          ['Total Income', formatCurrency(stats.totalIncome), '#16A34A', ArrowDownToLine, 'finance'],
          ['Outstanding', formatCurrency(stats.totalOutstanding), '#DC2626', TrendingDown, 'payments'],
          ['Staff Payments', formatCurrency(stats.totalStaffPaid), '#7C3AED', ArrowUpFromLine, 'finance'],
          ['Net Position', formatCurrency(Math.abs(stats.netBalance)), stats.netBalance >= 0 ? '#16A34A' : '#DC2626', CircleDollarSign, 'analytics'],
        ] satisfies Array<[string, string, string, LucideIcon, IconPalette]>).map(([label, value, color, Icon, palette]) => (
          <Card key={label} className="flex flex-row items-start gap-3 rounded-2xl border border-[#E3E7EE] bg-white p-4 shadow-sm">
            <ModuleIcon icon={Icon} palette={palette} />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-[#8A8A8A]">{label}</p>
              <p className="text-xl font-bold" style={{ color }}>{value}</p>
              {label === 'Net Position' && (
                <p className="text-[10px] font-semibold" style={{ color }}>
                  {stats.netBalance >= 0 ? 'Surplus' : 'Deficit'}
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>}

      {/* Report cards grid */}
      <div className="mb-4 flex items-center gap-3">
        <ModuleIcon icon={BarChart3} palette="analytics" className="size-8" />
        <h2 className="text-lg font-bold text-[#172033]">Available Reports</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {reports.map((report) => (
          <a
            key={report.href}
            href={report.href}
            className="flex flex-col rounded-2xl border border-[#E3E7EE] bg-white p-6 shadow-sm transition-colors hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            <div className="mb-4"><DashboardIcon artwork={report.artwork} palette={report.palette} /></div>
            <h3 className="mb-1 text-base font-bold text-[#172033]">{report.label}</h3>
            <p className="mb-4 flex-1 text-sm leading-relaxed text-[#8A8A8A]">{report.description}</p>
            <div className="text-sm font-semibold" style={{ color: report.color }}>
              <ActionIcon name="view" />View Report
            </div>
          </a>
        ))}
      </div>
    </AdminShell>
  );
}
