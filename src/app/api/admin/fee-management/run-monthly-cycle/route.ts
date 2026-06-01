import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { runMonthlyFeeCycle } from '@/lib/monthly-fee-cycle';
import { getRequestUser } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
    if (role === 'company') {
      return NextResponse.json({ error: 'Company accounts cannot run monthly cycles.' }, { status: 403 });
    }

    const result = await runMonthlyFeeCycle(true);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to run monthly cycle.',
      },
      { status: 500 }
    );
  }
}
