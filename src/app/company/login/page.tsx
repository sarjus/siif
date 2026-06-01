'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CompanyLoginRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const reset = searchParams.get('reset');
    router.replace(reset === '1' ? '/login?reset=1' : '/login');
  }, [router, searchParams]);

  return null;
}
