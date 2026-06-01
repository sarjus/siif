import { NextRequest, NextResponse } from 'next/server';
import { runMonthlyFeeCycle } from '@/lib/monthly-fee-cycle';

const sanitizeEnv = (value?: string | null) => (value ?? '').trim();

const isAuthorized = (request: NextRequest) => {
  const cronSecret = sanitizeEnv(process.env.CRON_SECRET);
  if (!cronSecret) return true;

  const authHeader = request.headers.get('authorization') || '';
  return authHeader === `Bearer ${cronSecret}`;
};

const shouldRunToday = (now: Date, force: boolean) => force || now.getUTCDate() === 1;

async function runMonthlyCycle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized cron trigger.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';
  const now = new Date();

  if (!shouldRunToday(now, force)) {
    return NextResponse.json({
      ran: false,
      reason: 'Skipped because today is not the 1st day of month (UTC).',
      utcDate: now.toISOString(),
    });
  }

  try {
    const result = await runMonthlyFeeCycle(force);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed monthly fee cycle run.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return runMonthlyCycle(request);
}

export async function POST(request: NextRequest) {
  return runMonthlyCycle(request);
}

