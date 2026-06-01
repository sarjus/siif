import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { runMonthlyFeeCycle } from '@/lib/monthly-fee-cycle';
import { requireAdmin } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;

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
