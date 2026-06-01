'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
      { label: 'Dashboard', href: '/admin/dashboard', description: 'Overview and applications' },
      { label: 'Applications', href: '/admin/dashboard', description: 'Track submissions' },
      { label: 'Reviewers', href: '/admin/reviewers', description: 'Manage reviewer accounts' },
    ],
  },
  {
    title: 'Fee Management',
    items: [
      { label: 'Overview', href: '/admin/fee-management', description: 'Collection dashboard' },
      { label: 'Fee Configuration', href: '/admin/fee-management/configuration', description: 'Per company plans' },
      { label: 'Monthly Invoices', href: '/admin/fee-management/invoices', description: 'Invoice generation and status' },
      { label: 'Record Payment', href: '/admin/fee-management/payments', description: 'Capture fee payments' },
      { label: 'Record Deposit', href: '/admin/fee-management/deposits', description: 'Manage refundable deposits' },
      { label: 'Transactions', href: '/admin/fee-management/transactions', description: 'All collection records' },
      { label: 'Receipts', href: '/admin/fee-management/receipts', description: 'View and reprint receipts' },
      { label: 'Notifications', href: '/admin/fee-management/notifications', description: 'Reminders and messages' },
      { label: 'Reports', href: '/admin/fee-management/reports', description: 'Analytics and export' },
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
    <div className="min-h-screen bg-[#F5F6F7]" style={{ fontFamily: 'var(--font-hanken-grotesk)' }}>
      <div className="mx-auto max-w-[1440px] flex">
        <aside className="hidden md:flex w-72 min-h-screen sticky top-0 flex-col bg-white border-r border-gray-200 p-6">
          <div className="mb-8">
            <p style={{ fontSize: '12px', color: '#8A8A8A', fontWeight: 600, textTransform: 'uppercase' }}>
              SIIF Admin
            </p>
            <h2 style={{ fontSize: '22px', color: '#FF3B3B', fontWeight: 700, marginTop: '4px' }}>
              Control Panel
            </h2>
          </div>

          <div className="space-y-4 mb-8 overflow-y-auto max-h-[60vh] pr-1">
            {navSections.map((section) => (
              <div key={section.title}>
                <p
                  style={{
                    fontSize: '11px',
                    color: '#8A8A8A',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}
                >
                  {section.title}
                </p>
                <div className="space-y-2">
                  {section.items.map((item) => {
                    const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(`${item.href}/`));
                    return (
                      <a
                        key={item.href + item.label}
                        href={item.href}
                        className="block rounded-xl px-4 py-3 transition-all"
                        style={{
                          backgroundColor: active ? '#FF3B3B' : '#F8F8F8',
                          border: active ? '1px solid #FF3B3B' : '1px solid #E5E5E5',
                        }}
                      >
                        <p style={{ fontSize: '14px', fontWeight: 700, color: active ? '#FFFFFF' : '#4A4A4A' }}>
                          {item.label}
                        </p>
                        <p style={{ fontSize: '11px', color: active ? '#FFE0E0' : '#8A8A8A', marginTop: '2px' }}>
                          {item.description}
                        </p>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] p-4">
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#8A8A8A', textTransform: 'uppercase' }}>
              Logged in as
            </p>
            <p style={{ fontSize: '13px', color: '#4A4A4A', marginTop: '4px', wordBreak: 'break-all' }}>
              {userEmail || '-'}
            </p>
            <Button
              onClick={onLogout}
              className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
              style={{ fontFamily: 'var(--font-hanken-grotesk)' }}
            >
              Logout
            </Button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <Card className="mb-6 border-0 shadow p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                {headerPrefix}
                <h1
                  className="text-3xl font-bold"
                  style={{ color: '#FF3B3B', fontFamily: '"Hanken Grotesk", sans-serif' }}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p style={{ color: '#8A8A8A', fontSize: '14px', marginTop: '4px' }}>{subtitle}</p>
                )}
              </div>
              <div className="flex flex-col md:items-end gap-3">
                <Button
                  onClick={onLogout}
                  className="md:hidden px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                  style={{ fontFamily: 'var(--font-hanken-grotesk)' }}
                >
                  Logout
                </Button>
                {headerActions}
              </div>
            </div>
          </Card>

          <div className="md:hidden mb-6 grid grid-cols-1 gap-2">
            {navSections.flatMap((section) => section.items).map((item) => {
              const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(`${item.href}/`));
              return (
                <a
                  key={`mobile-${item.href}-${item.label}`}
                  href={item.href}
                  className="rounded-lg px-4 py-3"
                  style={{
                    backgroundColor: active ? '#FF3B3B' : '#FFFFFF',
                    border: active ? '1px solid #FF3B3B' : '1px solid #E5E5E5',
                    color: active ? '#FFFFFF' : '#4A4A4A',
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                >
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
