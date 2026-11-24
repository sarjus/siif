'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ModuleIcon, NavigationIcon, type IconPalette } from '@/components/icons/icon';
import {
  Bell,
  BookOpenText,
  CalendarClock,
  ChartNoAxesCombined,
  ClipboardList,
  ContactRound,
  CreditCard,
  FileChartColumn,
  FileText,
  HandCoins,
  Landmark,
  LayoutGrid,
  LogOut,
  PanelsTopLeft,
  ReceiptText,
  SlidersHorizontal,
  UsersRound,
  WalletCards,
} from '@/components/icons/glyphs';

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
      { label: 'Dashboard', href: '/admin/dashboard', description: 'System overview', icon: LayoutGrid },
      { label: 'Applications', href: '/admin/applications', description: 'Track & manage submissions', icon: ClipboardList },
      { label: 'Reviewers', href: '/admin/reviewers', description: 'Manage reviewer accounts', icon: UsersRound },
      { label: 'Incubatee Directory', href: '/admin/incubatees', description: 'Verify incubatee profiles', icon: ContactRound },
    ],
  },
  {
    title: 'Incubation Fees',
    items: [
      { label: 'Fee Configuration', href: '/admin/fee-management/configuration', description: 'Set per-company fee plans', icon: SlidersHorizontal },
      { label: 'Monthly Invoices', href: '/admin/fee-management/invoices', description: 'Invoice generation & status', icon: FileText },
    ],
  },
  {
    title: 'Collections',
    items: [
      { label: 'Record Payment', href: '/admin/fee-management/payments', description: 'Capture incoming fee payments', icon: CreditCard },
      { label: 'Record Deposit', href: '/admin/fee-management/deposits', description: 'Manage refundable deposits', icon: Landmark },
      { label: 'Transactions', href: '/admin/fee-management/transactions', description: 'Full income & expenditure history', icon: WalletCards },
      { label: 'Receipts', href: '/admin/fee-management/receipts', description: 'View and reprint receipts', icon: ReceiptText },
      { label: 'Notifications', href: '/admin/fee-management/notifications', description: 'Send payment reminders', icon: Bell },
    ],
  },
  {
    title: 'Finance & Reports',
    items: [
      { label: 'Overview', href: '/admin/fee-management', description: 'Fee collection dashboard', icon: ChartNoAxesCombined },
      { label: 'Reports', href: '/admin/reports', description: 'Financial reports hub', icon: FileChartColumn },
      { label: 'Ledger', href: '/admin/ledger', description: 'General ledger — debit & credit', icon: BookOpenText },
    ],
  },
  {
    title: 'HR & Facilities',
    items: [
      { label: 'Staff Payments', href: '/admin/staff-payments', description: 'Salary & honorarium disbursements', icon: HandCoins },
      { label: 'Conference Room', href: '/admin/conference', description: 'Manage room bookings', icon: CalendarClock },
      { label: 'Workspace Allocation', href: '/admin/workspace-allocations', description: 'Assign chairs and cubicles', icon: PanelsTopLeft },
    ],
  },
];

const modulePalettes: Record<string, IconPalette> = {
  '/admin/applications': 'innovation', '/admin/incubatees': 'innovation',
  '/admin/fee-management/invoices': 'payments', '/admin/fee-management/payments': 'payments',
  '/admin/fee-management/receipts': 'payments', '/admin/fee-management/deposits': 'finance',
  '/admin/fee-management/transactions': 'finance', '/admin/staff-payments': 'finance',
  '/admin/fee-management': 'analytics', '/admin/reports': 'analytics', '/admin/ledger': 'documents',
  '/admin/conference': 'events', '/admin/workspace-allocations': 'workspace',
};
const navItems = navSections.flatMap((section) => section.items);

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
  const currentModule = navItems.find(({ href }) => href === pathname)
    ?? navItems.find(({ href }) => pathname.startsWith(`${href}/`));

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
                        aria-current={pathname === item.href ? 'page' : undefined}
                        className={`group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${
                          active
                            ? 'border-[#FBD5DA] bg-[#FFF1F2] text-[#9F1239]'
                            : 'border-transparent text-[#4A5568] hover:border-[#E5E7EB] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition-colors ${
                          active ? 'bg-[#C52936] text-white ring-[#B21C29]' : 'bg-slate-50 text-slate-600 ring-slate-200/75 group-hover:bg-white group-hover:text-[#B42332]'
                        }`}>
                          <NavigationIcon icon={Icon} />
                        </span>
                        <span>
                          <span className="block text-sm font-bold">{item.label}</span>
                          <span className={`mt-0.5 block text-[11px] ${active ? 'text-[#9C4353]' : 'text-slate-600'}`}>
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
              <LogOut aria-hidden="true" className="size-4" strokeWidth={1.8} />
              Logout
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
          <header className="mb-6 border-b border-[#E3E7EE] pb-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                {headerPrefix}
                <div className="flex items-center gap-3">
                  {currentModule && <ModuleIcon icon={currentModule.icon} palette={modulePalettes[currentModule.href]} />}
                  <h1
                    className="text-2xl font-bold tracking-normal md:text-3xl"
                    style={{ color: '#D92828', fontFamily: '"Hanken Grotesk", sans-serif' }}
                  >
                    {title}
                  </h1>
                </div>
                {subtitle && (
                  <p className="mt-1 max-w-3xl text-sm text-[#667085]">{subtitle}</p>
                )}
              </div>
              <div className="flex flex-col md:items-end gap-3">
                <Button
                  onClick={onLogout}
                  className="h-9 gap-2 bg-[#172033] text-white hover:bg-[#0F172A] md:hidden"
                >
                  <LogOut aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  Logout
                </Button>
                {headerActions}
              </div>
            </div>
          </header>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              return (
                <a
                  key={`mobile-${item.href}-${item.label}`}
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                    active ? 'border-[#FBD5DA] bg-[#FFF1F2] text-[#9F1239]' : 'border-[#E3E7EE] bg-white text-[#344054]'
                  }`}
                >
                  <NavigationIcon icon={Icon} />
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
