'use client';

import { useEffect, useState } from 'react';
import { supabase, getSafeSession } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import {
  Bell,
  Banknote,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileText,
  Gauge,
  Landmark,
  ReceiptText,
  Settings,
  Upload,
  Users,
  WalletCards,
} from 'lucide-react';

type Section = {
  title: string;
  color: string;
  bg: string;
  items: { label: string; description: string; href: string; icon: React.ElementType }[];
};

const sections: Section[] = [
  {
    title: 'Core',
    color: '#DC2626',
    bg: '#FFF7F7',
    items: [
      { label: 'Applications', description: 'View and manage incubation applications', href: '/admin/applications', icon: ClipboardList },
      { label: 'Reviewers', description: 'Manage reviewer accounts and access', href: '/admin/reviewers', icon: Users },
    ],
  },
  {
    title: 'Incubation Fees',
    color: '#1D4ED8',
    bg: '#EFF6FF',
    items: [
      { label: 'Fee Configuration', description: 'Set per-company monthly fee plans', href: '/admin/fee-management/configuration', icon: Settings },
      { label: 'Monthly Invoices', description: 'Invoice generation and payment status', href: '/admin/fee-management/invoices', icon: FileText },
      { label: 'Payment Submissions', description: 'Verify company-submitted payment proofs', href: '/admin/fee-management/payment-submissions', icon: Upload },
    ],
  },
  {
    title: 'Collections',
    color: '#B45309',
    bg: '#FFFBEB',
    items: [
      { label: 'Record Payment', description: 'Capture incoming fee payments', href: '/admin/fee-management/payments', icon: CreditCard },
      { label: 'Record Deposit', description: 'Manage refundable security deposits', href: '/admin/fee-management/deposits', icon: Landmark },
      { label: 'Transactions', description: 'Full income and expenditure history', href: '/admin/fee-management/transactions', icon: WalletCards },
      { label: 'Receipts', description: 'View, download and reprint receipts', href: '/admin/fee-management/receipts', icon: ReceiptText },
      { label: 'Notifications', description: 'Send payment reminders to companies', href: '/admin/fee-management/notifications', icon: Bell },
    ],
  },
  {
    title: 'Finance & Reports',
    color: '#059669',
    bg: '#ECFDF5',
    items: [
      { label: 'Overview', description: 'Fee collection dashboard and summaries', href: '/admin/fee-management', icon: Gauge },
      { label: 'Reports', description: 'Financial reports hub — 6 reports', href: '/admin/reports', icon: FileBarChart },
      { label: 'Ledger', description: 'General ledger — track debit & credit', href: '/admin/ledger', icon: BookOpen },
    ],
  },
  {
    title: 'HR & Facilities',
    color: '#7C3AED',
    bg: '#F5F3FF',
    items: [
      { label: 'Staff Payments', description: 'Salary and honorarium disbursements', href: '/admin/staff-payments', icon: Banknote },
      { label: 'Conference Room', description: 'Manage room bookings and requests', href: '/admin/conference', icon: CalendarDays },
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

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

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
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="group flex flex-col items-start rounded-2xl border border-[#E3E7EE] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-transparent hover:shadow-md"
                    style={{ ['--hover-shadow' as string]: `0 8px 24px ${section.color}22` }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${section.color}33`;
                      (e.currentTarget as HTMLElement).style.borderColor = `${section.color}44`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = '';
                      (e.currentTarget as HTMLElement).style.borderColor = '';
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-110"
                      style={{ backgroundColor: section.bg }}
                    >
                      <Icon className="size-5" style={{ color: section.color }} />
                    </div>

                    {/* Label */}
                    <p className="text-sm font-bold text-[#172033] leading-tight">{item.label}</p>

                    {/* Description */}
                    <p className="mt-1 text-[11px] leading-relaxed text-[#8A8A8A]">{item.description}</p>

                    {/* Arrow */}
                    <div className="mt-3 text-xs font-semibold transition-colors duration-200" style={{ color: section.color }}>
                      Open →
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
