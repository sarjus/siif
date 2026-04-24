import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reviewer Portal - SIIF',
  description: 'Review incubation applications',
};

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
