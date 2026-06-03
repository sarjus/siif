import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabaseAdmin = createServiceRoleClient();

    const [{ data: companies, error: compError }, { data: notifications, error: notifError }] = await Promise.all([
      supabaseAdmin.from('applications').select('id, business_name, email').eq('status', 'approved').order('business_name', { ascending: true }),
      supabaseAdmin.from('notifications').select('*, applications(business_name, email)').order('sent_at', { ascending: false }).limit(100),
    ]);

    if (compError) return NextResponse.json({ error: compError.message }, { status: 400 });
    if (notifError) return NextResponse.json({ error: notifError.message }, { status: 400 });

    return NextResponse.json({ companies: companies || [], notifications: notifications || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { recipientType, selectedCompanyIds, title, message } = await request.json();
    if (!title || !message) return NextResponse.json({ error: 'Title and message are required.' }, { status: 400 });

    const supabaseAdmin = createServiceRoleClient();

    // Fetch all approved companies
    const { data: allCompanies, error: compError } = await supabaseAdmin
      .from('applications')
      .select('id, business_name, email')
      .eq('status', 'approved');
    if (compError) return NextResponse.json({ error: compError.message }, { status: 400 });

    let targetCompanies = allCompanies || [];

    if (recipientType === 'selected') {
      if (!selectedCompanyIds?.length) return NextResponse.json({ error: 'Select at least one company.' }, { status: 400 });
      targetCompanies = targetCompanies.filter((c) => selectedCompanyIds.includes(c.id));
    } else if (recipientType === 'overdue') {
      const { data: overdueInvoices } = await supabaseAdmin.from('incubation_fee_invoices').select('company_id').eq('status', 'overdue');
      const ids = new Set((overdueInvoices || []).map((i) => i.company_id));
      targetCompanies = targetCompanies.filter((c) => ids.has(c.id));
    } else if (recipientType === 'pending_deposits') {
      const { data: pendingDeposits } = await supabaseAdmin.from('company_deposits').select('company_id').eq('status', 'pending');
      const ids = new Set((pendingDeposits || []).map((d) => d.company_id));
      targetCompanies = targetCompanies.filter((c) => ids.has(c.id));
    }

    if (targetCompanies.length === 0) return NextResponse.json({ error: 'No matching companies found.' }, { status: 400 });

    const rows = targetCompanies.map((c) => ({ title, message, recipient_type: recipientType, company_id: c.id, sent_by: user.email }));
    const { error: insertError } = await supabaseAdmin.from('notifications').insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

    return NextResponse.json({ success: true, sent: rows.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send notification' }, { status: 500 });
  }
}
