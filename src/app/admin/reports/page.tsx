'use client';

import { useEffect, useState } from 'react';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/fee-management';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  BookOpen,
  Building2,
  CircleDollarSign,
  FileText,
  TrendingDown,
  Users,
} from 'lucide-react';

const reports = [
  {
    label: 'Collection Report',
    description: 'All fee payments received — monthly fees and deposits',
    href: '/admin/reports/collection',
    icon: ArrowDownToLine,
    color: '#16A34A',
    bg: '#ECFDF5',
  },
  {
    label: 'Outstanding Report',
    description: 'Unpaid and partially paid invoices with balances due',
    href: '/admin/reports/outstanding',
    icon: TrendingDown,
    color: '#DC2626',
    bg: '#FFF7F7',
  },
  {
    label: 'Deposit Report',
    description: 'Refundable security deposits — collected, refunded, balance',
    href: '/admin/reports/deposits',
    icon: Building2,
    color: '#2AA0D3',
    bg: '#EFF9FF',
  },
  {
    label: 'Staff Payments Report',
    description: 'Salary and honorarium disbursements to staff',
    href: '/admin/reports/staff-payments',
    icon: Users,
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  {
    label: 'Ledger Report',
    description: 'Full general ledger with running debit/credit balance',
    href: '/admin/reports/ledger',
    icon: BookOpen,
    color: '#0F766E',
    bg: '#F0FDFA',
  },
  {
    label: 'Invoice Report',
    description: 'All invoices generated — status, amounts, billing months',
    href: '/admin/reports/invoices',
    icon: FileText,
    color: '#1D4ED8',
    bg: '#EFF6FF',
  },
];

export default function ReportsHubPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalOutstanding: 0,
    totalStaffPaid: 0,
    netBalance: 0,
  });

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

        if (reportsRes.ok) {
          const p = await reportsRes.json();
          const totalIncome = (p.collections || []).reduce((s: number, c: { amount_collected: number }) => s + Number(c.amount_collected || 0), 0);
          const totalOutstanding = (p.invoices || []).filter((i: { status: string }) => i.status !== 'paid').reduce((s: number, i: { amount: number; amount_paid: number }) => s + Math.max(Number(i.amount || 0) - Number(i.amount_paid || 0), 0), 0);
          let totalStaffPaid = 0;
          if (staffRes.ok) {
            const sp = await staffRes.json();
            totalStaffPaid = (sp.payments || []).reduce((s: number, p: { amount: number }) => s + Number(p.amount || 0), 0);
          }
          setStats({ totalIncome, totalOutstanding, totalStaffPaid, netBalance: totalIncome - totalStaffPaid });
        }
      } catch { /* stats load failed silently */ }

      setLoading(false);
    };
    load();
  }, [router]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Reports" subtitle="Financial and operational reports with export options" userEmail={userEmail} onLogout={handleLogout}>
      {/* Summary strip */}
      <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          ['Total Income', formatCurrency(stats.totalIncome), '#16A34A', ArrowDownToLine],
          ['Outstanding', formatCurrency(stats.totalOutstanding), '#DC2626', TrendingDown],
          ['Staff Payments', formatCurrency(stats.totalStaffPaid), '#7C3AED', ArrowUpFromLine],
          ['Net Position', formatCurrency(Math.abs(stats.netBalance)), stats.netBalance >= 0 ? '#16A34A' : '#DC2626', CircleDollarSign],
        ] as [string, string, string, React.ElementType][]).map(([label, value, color, Icon]) => (
          <Card key={String(label)} className="border-0 shadow p-5 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F6F7]">
              <Icon className="size-5" style={{ color }} />
            </div>
            <div>
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
      </div>

      {/* Report cards grid */}
      <div className="mb-4 flex items-center gap-3">
        <BarChart3 className="size-5 text-[#FF3B3B]" />
        <h2 className="text-lg font-bold text-[#172033]">Available Reports</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <a
              key={report.href}
              href={report.href}
              className="group flex flex-col rounded-2xl border border-[#E3E7EE] bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${report.color}44`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${report.color}22`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '';
                (e.currentTarget as HTMLElement).style.boxShadow = '';
              }}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                style={{ backgroundColor: report.bg }}>
                <Icon className="size-6" style={{ color: report.color }} />
              </div>
              <h3 className="mb-1 text-base font-bold text-[#172033]">{report.label}</h3>
              <p className="mb-4 text-sm text-[#8A8A8A] leading-relaxed flex-1">{report.description}</p>
              <div className="text-sm font-semibold transition-colors" style={{ color: report.color }}>
                View Report →
              </div>
            </a>
          );
        })}
      </div>
    </AdminShell>
  );
}
