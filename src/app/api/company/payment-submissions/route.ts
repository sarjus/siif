import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, getRequestUser } from '@/lib/server-auth';

// Company submits payment proof for admin verification
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
    if (role !== 'company') {
      return NextResponse.json({ error: 'Only company accounts can submit payment details.' }, { status: 403 });
    }

    const body = await request.json();
    const { companyId, invoiceId, amountPaid, paymentMode, transactionReference, paymentDate, remarks } = body;

    if (!companyId || !amountPaid || !paymentMode || !paymentDate) {
      return NextResponse.json({ error: 'Company, amount, payment mode, and date are required.' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify this company belongs to the authenticated user
    const { data: application, error: appError } = await supabaseAdmin
      .from('applications')
      .select('id, email, business_name')
      .eq('id', companyId)
      .eq('status', 'approved')
      .maybeSingle();

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found or not approved.' }, { status: 404 });
    }

    const userEmail = (user.email || '').trim().toLowerCase();
    const appEmail = (application.email || '').trim().toLowerCase();
    if (userEmail !== appEmail) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { data, error: insertError } = await supabaseAdmin
      .from('company_payment_submissions')
      .insert({
        company_id: companyId,
        invoice_id: invoiceId || null,
        amount_paid: Number(amountPaid),
        payment_mode: paymentMode,
        transaction_reference: transactionReference || null,
        payment_date: paymentDate,
        remarks: remarks || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, submission: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to submit payment details' },
      { status: 500 }
    );
  }
}

// Company fetches their own submissions
export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Session expired.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required.' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify ownership
    const { data: application } = await supabaseAdmin
      .from('applications')
      .select('email')
      .eq('id', companyId)
      .maybeSingle();

    const userEmail = (user.email || '').trim().toLowerCase();
    const appEmail = ((application?.email) || '').trim().toLowerCase();
    const role = String(user.user_metadata?.role || '').toLowerCase();

    if (role !== 'admin' && userEmail !== appEmail) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('company_payment_submissions')
      .select('*, incubation_fee_invoices(invoice_number, billing_month)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ submissions: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load submissions' },
      { status: 500 }
    );
  }
}
