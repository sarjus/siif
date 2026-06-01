import { NextResponse } from 'next/server';
import { runMonthlyFeeCycle } from '@/lib/monthly-fee-cycle';

export async function POST() {
  try {
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