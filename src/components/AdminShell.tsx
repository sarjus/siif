'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Bell,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  Upload,
  Users,
  WalletCards,
  Banknote,
  CalendarDays,
  BookOpen,
} from 'lucide-react';

type AdminShellProps = {
  title: string;
  subtitle?: string;
  userEmail?: string;
  onLogout: () => void;
  children: ReactNode;
  headerPrefix?: ReactNode;
  headerActions?: ReactNode;
};

const navSections = [
  {
    title: 'Core',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', description: 'System overview', icon: LayoutDashboard },
      { label: 'Applications', href: '/admin/applications', description: 'Track submissions', icon: ClipboardList },
      { label: 'Reviewers', href: '/admin/reviewers', description: 'Manage reviewer accounts', icon: Users },
    ],
  },
  {
    title: 'Fee Management',
    items: [
      { label: 'Overview', href: '/admin/fee-management', description: 'Collection dashboard', icon: Gauge },
      { label: 'Fee Configuration', href: '/admin/fee-management/configuration', description: 'Per company plans', icon: Settings },
      { label: 'Monthly Invoices', href: '/admin/fee-management/invoices', description: 'Invoice generation and status', icon: FileText },
      { label: 'Record Payment', href: '/admin/fee-management/payments', description: 'Capture fee payments', icon: CreditCard },
      { label: 'Record Deposit', href: '/admin/fee-management/deposits', description: 'Manage refundable deposits', icon: Landmark },
      { label: 'Transactions', href: '/admin/fee-management/transactions', description: 'All collection records', icon: WalletCards },
      { label: 'Receipts', href: '/admin/fee-management/receipts', description: 'View and reprint receipts', icon: ReceiptText },
      { label: 'Notifications', href: '/admin/fee-management/notifications', description: 'Reminders and messages', icon: Bell },
      { label: 'Reports', href: '/admin/fee-management/reports', description: 'Analytics and export', icon: FileBarChart },
      { label: 'Payment Submissions', href: '/admin/fee-management/payment-submissions', description: 'Verify company payments', icon: Upload },
    ],
  },
  {
    title: 'Staff & Payroll',
    items: [
      { label: 'Staff Payments', href: '/admin/staff-payments', description: 'Salary & honorarium payments', icon: Banknote },
    ],
  },
  {
    title: 'Facilities',
    items: [
      { label: 'Conference Room', href: '/admin/conference', description: 'Manage room bookings', icon: CalendarDays },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Ledger', href: '/admin/ledger', description: 'General ledger — income & expenditure', icon: BookOpen },
    ],
  },
];

export default function AdminShell({
  title,
  subtitle,
  userEmail,
  onLogout,
  children,
  headerPrefix,
  headerActions,
}: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#172033]" style={{ fontFamily: 'var(--font-hanken-grotesk)' }}>
      <div className="mx-auto flex max-w-[1480px]">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-[#E3E7EE] bg-white px-4 py-5 md:flex">
          <div className="mb-6 rounded-lg border border-[#FFE1E1] bg-[#FFF7F7] px-4 py-3">
            <p className="text-[11px] font-bold uppercase text-[#8A8A8A]">SIIF Admin</p>
            <h2 className="mt-1 text-xl font-bold text-[#D92828]">Control Panel</h2>
          </div>

          <div className="mb-6 flex-1 space-y-5 overflow-y-auto pr-1">
            {navSections.map((section) => (
              <div key={section.title}>
                <p className="mb-2 px-2 text-[11px] font-bold uppercase text-[#8A8A8A]">{section.title}</p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = pathname === item.href ||
                      (item.href !== '/admin/dashboard' && item.href !== '/admin/applications' && pathname.startsWith(`${item.href}/`)) ||
                      (item.href === '/admin/applications' && (pathname === '/admin/applications' || pathname.startsWith('/admin/applications/')));
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.href + item.label}
                        href={item.href}
                        className={`group flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                          active
                            ? 'border-[#FF3B3B] bg-[#FF3B3B] text-white shadow-sm'
                            : 'border-transparent text-[#4A5568] hover:border-[#E5E7EB] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <Icon className={`mt-0.5 size-4 ${active ? 'text-white' : 'text-[#8A8A8A] group-hover:text-[#FF3B3B]'}`} />
                        <span>
                          <span className="block text-sm font-bold">{item.label}</span>
                          <span className={`mt-0.5 block text-[11px] ${active ? 'text-[#FFE1E1]' : 'text-[#8A8A8A]'}`}>
                            {item.description}
                          </span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[#E3E7EE] bg-[#F8FAFC] p-4">
            <p className="text-[11px] font-bold uppercase text-[#8A8A8A]">Logged in as</p>
            <p className="mt-1 break-all text-sm font-semibold text-[#344054]">{userEmail || '-'}</p>
            <Button
              onClick={onLogout}
              className="mt-4 h-9 w-full gap-2 bg-[#172033] text-white hover:bg-[#0F172A]"
            >
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
          <header className="mb-6 border-b border-[#E3E7EE] pb-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                {headerPrefix}
                <h1
                  className="text-2xl font-bold tracking-normal md:text-3xl"
                  style={{ color: '#D92828', fontFamily: '"Hanken Grotesk", sans-serif' }}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-1 max-w-3xl text-sm text-[#667085]">{subtitle}</p>
                )}
              </div>
              <div className="flex flex-col md:items-end gap-3">
                <Button
                  onClick={onLogout}
                  className="h-9 gap-2 bg-[#172033] text-white hover:bg-[#0F172A] md:hidden"
                >
                  <LogOut className="size-4" />
                  Logout
                </Button>
                {headerActions}
              </div>
            </div>
          </header>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {navSections.flatMap((section) => section.items).map((item) => {
              const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              return (
                <a
                  key={`mobile-${item.href}-${item.label}`}
                  href={item.href}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                    active ? 'border-[#FF3B3B] bg-[#FF3B3B] text-white' : 'border-[#E3E7EE] bg-white text-[#344054]'
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </a>
              );
            })}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
