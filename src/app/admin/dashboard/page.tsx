'use client';

import { FeedbackIcon } from '@/components/icons/feedback';

import { useEffect, useState } from 'react';
import { database, getSafeSession } from '@/lib/database';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { DashboardIcon, type DashboardArtwork, type IconPalette } from '@/components/icons/icon';

type Section = {
  title: string;
  color: string;
  items: { label: string; description: string; href: string; artwork: DashboardArtwork; palette: IconPalette }[];
};

const sections: Section[] = [
  {
    title: 'Core',
    color: '#DC2626',
    items: [
      { label: 'Applications', description: 'View and manage incubation applications', href: '/admin/applications', artwork: 'applications', palette: 'innovation' },
      { label: 'Reviewers', description: 'Manage reviewer accounts and access', href: '/admin/reviewers', artwork: 'reviewers', palette: 'general' },
      { label: 'Incubatee Directory', description: 'Verify and manage incubatee profiles', href: '/admin/incubatees', artwork: 'directory', palette: 'innovation' },
    ],
  },
  {
    title: 'Incubation Fees',
    color: '#1D4ED8',
    items: [
      { label: 'Fee Configuration', description: 'Set per-company monthly fee plans', href: '/admin/fee-management/configuration', artwork: 'configuration', palette: 'workspace' },
      { label: 'Monthly Invoices', description: 'Invoice generation and payment status', href: '/admin/fee-management/invoices', artwork: 'invoices', palette: 'payments' },
    ],
  },
  {
    title: 'Collections',
    color: '#B45309',
    items: [
      { label: 'Record Payment', description: 'Capture incoming fee payments', href: '/admin/fee-management/payments', artwork: 'payments', palette: 'payments' },
      { label: 'Record Deposit', description: 'Manage refundable security deposits', href: '/admin/fee-management/deposits', artwork: 'deposits', palette: 'finance' },
      { label: 'Transactions', description: 'Full income and expenditure history', href: '/admin/fee-management/transactions', artwork: 'transactions', palette: 'finance' },
      { label: 'Receipts', description: 'View, download and reprint receipts', href: '/admin/fee-management/receipts', artwork: 'receipts', palette: 'payments' },
      { label: 'Notifications', description: 'Send payment reminders to companies', href: '/admin/fee-management/notifications', artwork: 'notifications', palette: 'general' },
    ],
  },
  {
    title: 'Finance & Reports',
    color: '#059669',
    items: [
      { label: 'Overview', description: 'Fee collection dashboard and summaries', href: '/admin/fee-management', artwork: 'overview', palette: 'analytics' },
      { label: 'Reports', description: 'Financial reports hub — 6 reports', href: '/admin/reports', artwork: 'reports', palette: 'analytics' },
      { label: 'Ledger', description: 'General ledger — track debit & credit', href: '/admin/ledger', artwork: 'ledger', palette: 'documents' },
    ],
  },
  {
    title: 'HR & Facilities',
    color: '#7C3AED',
    items: [
      { label: 'Staff Payments', description: 'Salary and honorarium disbursements', href: '/admin/staff-payments', artwork: 'staff-payments', palette: 'finance' },
      { label: 'Conference Room', description: 'Manage room bookings and requests', href: '/admin/conference', artwork: 'conference', palette: 'events' },
      { label: 'Workspace Allocation', description: 'Assign chairs and cubicles to companies', href: '/admin/workspace-allocations', artwork: 'workspace', palette: 'workspace' },
    ],
  },
];

export default function AdminDashboard() {
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');
      setLoading(false);
    };
    load();
  }, [router]);

  const handleLogout = async () => { await database.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><FeedbackIcon kind="loading" />Loading...</div>;

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Welcome to SIIF Admin Control Panel — select a module to get started"
      userEmail={userEmail}
      onLogout={handleLogout}
    >
      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.title}>
            {/* Section header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="h-0.5 w-6 rounded-full" style={{ backgroundColor: section.color }} />
              <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: section.color }}>
                {section.title}
              </h2>
              <div className="h-0.5 flex-1 rounded-full bg-[#E3E7EE]" />
            </div>

            {/* Icon cards grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {section.items.map((item) => {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex flex-col items-start rounded-2xl border border-[#E3E7EE] bg-white p-5 shadow-sm transition-colors hover:border-slate-300">
                    <div className="mb-4"><DashboardIcon artwork={item.artwork} palette={item.palette} /></div>

                    {/* Label */}
                    <p className="text-sm font-bold text-[#172033] leading-tight">{item.label}</p>

                    {/* Description */}
                    <p className="mt-1 text-[11px] leading-relaxed text-[#8A8A8A]">{item.description}</p>

                    <div className="mt-3 text-xs font-semibold transition-colors duration-200" style={{ color: section.color }}>
                      Open
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
