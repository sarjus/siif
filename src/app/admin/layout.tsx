import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard - SIIF',
  description: 'Manage incubation applications',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {children}
    </div>
  );
}
