import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabaseAdmin = createServiceRoleClient();

    const [{ data: invoices, error: invoicesError }, { data: deposits, error: depositsError }, { data: collections, error: collectionsError }] =
      await Promise.all([
        supabaseAdmin
          .from('incubation_fee_invoices')
          .select('status, amount, due_date, amount_paid'),
        supabaseAdmin
          .from('company_deposits')
          .select('status, amount_collected, balance_amount'),
        supabaseAdmin
          .from('fee_collections')
          .select('amount_collected, created_at')
          .eq('status', 'recorded')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

    if (invoicesError) return NextResponse.json({ error: invoicesError.message }, { status: 400 });
    if (depositsError) return NextResponse.json({ error: depositsError.message }, { status: 400 });
    if (collectionsError) return NextResponse.json({ error: collectionsError.message }, { status: 400 });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const stats = {
      totalMonthlyCollection: (collections || []).reduce(
        (sum, item) => sum + Number(item.amount_collected || 0),
        0
      ),
      totalDepositsCollected: (deposits || []).reduce(
        (sum, item) => sum + Number(item.amount_collected || 0),
        0
      ),
      pendingFees: (invoices || []).filter(
        (item) => item.status === 'pending' || item.status === 'partially_paid'
      ).length,
      pendingDeposits: (deposits || []).filter((item) => item.status === 'pending').length,
      overdueFees: (invoices || []).filter((item) => item.status === 'overdue').length,
      recentPayments: (collections || []).length,
      upcomingDuePayments: (invoices || []).filter((item) => {
        const due = new Date(item.due_date);
        return due >= monthStart && due <= nextWeek && item.status !== 'paid';
      }).length,
    };

    return NextResponse.json({ stats });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load overview' },
      { status: 500 }
    );
  }
}
