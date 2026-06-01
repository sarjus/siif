import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Company Portal - SIIF',
  description: 'Company access for approved SIIF applications',
};

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
