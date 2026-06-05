import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabaseAdmin = createServiceRoleClient();

    const [
      { data: invoices, error: invoicesError },
      { data: deposits, error: depositsError },
      { data: collections, error: collectionsError },
      { data: allCollections, error: allCollectionsError },
      { data: companies, error: companiesError },
    ] = await Promise.all([
      supabaseAdmin
        .from('incubation_fee_invoices')
        .select('status, amount, due_date, amount_paid, company_id, billing_month')
        .neq('status', 'void'),
      supabaseAdmin
        .from('company_deposits')
        .select('status, amount_collected, balance_amount, deposit_amount'),
      supabaseAdmin
        .from('fee_collections')
        .select('amount_collected, created_at, collection_type')
        .eq('status', 'recorded')
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('fee_collections')
        .select('amount_collected, created_at, collection_type')
        .eq('status', 'recorded')
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('applications')
        .select('id, business_name')
        .eq('status', 'approved'),
    ]);

    if (invoicesError) return NextResponse.json({ error: invoicesError.message }, { status: 400 });
    if (depositsError) return NextResponse.json({ error: depositsError.message }, { status: 400 });
    if (collectionsError) return NextResponse.json({ error: collectionsError.message }, { status: 400 });
    if (allCollectionsError) return NextResponse.json({ error: allCollectionsError.message }, { status: 400 });
    if (companiesError) return NextResponse.json({ error: companiesError.message }, { status: 400 });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const stats = {
      totalMonthlyCollection: (collections || []).reduce((sum, item) => sum + Number(item.amount_collected || 0), 0),
      totalDepositsCollected: (deposits || []).reduce((sum, item) => sum + Number(item.amount_collected || 0), 0),
      pendingFees: (invoices || []).filter((item) => item.status === 'pending' || item.status === 'partially_paid').length,
      pendingDeposits: (deposits || []).filter((item) => item.status === 'pending' && Number(item.deposit_amount || 0) > 0).length,
      overdueFees: (invoices || []).filter((item) => item.status === 'overdue').length,
      recentPayments: (collections || []).length,
      upcomingDuePayments: (invoices || []).filter((item) => {
        const due = new Date(item.due_date);
        return due >= monthStart && due <= nextWeek && item.status !== 'paid';
      }).length,
    };

    // ── Chart 1: Invoice status distribution (donut) ─────────────────
    const invoiceStatusCounts = {
      paid: 0, pending: 0, partially_paid: 0, overdue: 0,
    };
    (invoices || []).forEach((inv) => {
      if (inv.status in invoiceStatusCounts) {
        invoiceStatusCounts[inv.status as keyof typeof invoiceStatusCounts]++;
      }
    });

    // ── Chart 2: Monthly collections over last 6 months (bar) ────────
    const monthlyCollections: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCollections[key] = 0;
    }
    (allCollections || []).forEach((col) => {
      const d = new Date(col.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthlyCollections) {
        monthlyCollections[key] += Number(col.amount_collected || 0);
      }
    });

    // ── Chart 3: Per-company outstanding vs paid (bar) ────────────────
    const companyMap: Record<string, { name: string; paid: number; outstanding: number }> = {};
    (companies || []).forEach((c) => {
      companyMap[c.id] = { name: c.business_name || 'Company', paid: 0, outstanding: 0 };
    });
    (invoices || []).forEach((inv) => {
      if (companyMap[inv.company_id]) {
        companyMap[inv.company_id].paid += Number(inv.amount_paid || 0);
        companyMap[inv.company_id].outstanding += Math.max(Number(inv.amount || 0) - Number(inv.amount_paid || 0), 0);
      }
    });

    // ── Chart 4: Collection type breakdown ────────────────────────────
    const collectionTypes: Record<string, number> = {};
    (allCollections || []).forEach((col) => {
      const t = col.collection_type || 'other';
      collectionTypes[t] = (collectionTypes[t] || 0) + Number(col.amount_collected || 0);
    });

    return NextResponse.json({
      stats,
      charts: {
        invoiceStatus: invoiceStatusCounts,
        monthlyCollections,
        companyBreakdown: Object.values(companyMap),
        collectionTypes,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load overview' },
      { status: 500 }
    );
  }
}
