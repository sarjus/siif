'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreditCard, LayoutDashboard, LogOut, CalendarDays } from 'lucide-react';

type CompanyShellProps = {
  title: string;
  subtitle?: string;
  companyName?: string | null;
  onLogout: () => void;
  children: ReactNode;
  headerActions?: ReactNode;
};

const navItems = [
  { label: 'Dashboard', href: '/company/dashboard', icon: LayoutDashboard },
  { label: 'Payments', href: '/company/payments', icon: CreditCard },
  { label: 'Conference Room', href: '/company/conference', icon: CalendarDays },
];

export default function CompanyShell({
  title,
  subtitle,
  companyName,
  onLogout,
  children,
  headerActions,
}: CompanyShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#172033]" style={{ fontFamily: 'var(--font-hanken-grotesk)' }}>
      <header className="border-b border-[#E3E7EE] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase text-[#8A8A8A]">SIIF Company Portal</p>
              <h1 className="mt-1 text-2xl font-bold tracking-normal text-[#172033] md:text-3xl">{title}</h1>
              {subtitle && <p className="mt-1 max-w-2xl text-sm text-[#667085]">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {companyName && (
                <span className="rounded-lg border border-[#E3E7EE] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#344054]">
                  {companyName}
                </span>
              )}
              {headerActions}
              <Button onClick={onLogout} className="h-9 gap-2 bg-[#172033] text-white hover:bg-[#0F172A]">
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'border-[#FF3B3B] bg-[#FF3B3B] text-white'
                      : 'border-[#E3E7EE] bg-white text-[#344054] hover:border-[#FF3B3B]'
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
