'use client';

import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Applications', href: '/admin/applications' },
  { label: 'Reviewers', href: '/admin/reviewers' },
];

export default function AdminNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin/dashboard') return pathname === '/admin/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="flex gap-1"
      style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}
    >
      {navItems.map(({ label, href }) => (
        <a
          key={href}
          href={href}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            backgroundColor: isActive(href) ? '#FF3B3B' : 'transparent',
            color: isActive(href) ? '#fff' : '#4A4A4A',
            border: isActive(href) ? '1px solid #FF3B3B' : '1px solid #D0D0D0',
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
