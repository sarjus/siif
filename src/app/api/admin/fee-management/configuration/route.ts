import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, getRequestUser } from '@/lib/server-auth';

type SaveConfigurationBody = {
  companyId?: string;
  monthlyFee?: number;
  refundableDeposit?: number;
  depositCollectionDate?: string | null;
  depositStatus?: string;
  startDate?: string;
  dueDay?: number;
  gracePeriodDays?: number;
  status?: string;
};

const depositStatuses = new Set(['pending', 'collected', 'partially_refunded', 'refunded']);
const settingStatuses = new Set(['active', 'inactive']);

const getAuthorizedUser = async (request: NextRequest) => {
  const user = await getRequestUser(request);
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: 'Session expired. Please sign out, sign in again, and retry.' },
        { status: 401 }
      ),
    };
  }

  const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
  if (role === 'company') {
    return {
      user: null,
      response: NextResponse.json(
        { error: 'Company accounts cannot access fee configuration.' },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
};

export async function GET(request: NextRequest) {
  try {
    const { response } = await getAuthorizedUser(request);
    if (response) return response;

    const supabaseAdmin = createServiceRoleClient();
    const [
      { data: apps, error: appError },
      { data: settingsData, error: settingsError },
      { data: depositsData, error: depositsError },
    ] = await Promise.all([
      supabaseAdmin
        .from('applications')
        .select('id, business_name, lead_name, email, status')
        .eq('status', 'approved')
        .order('business_name', { ascending: true }),
      supabaseAdmin.from('incubation_fee_settings').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('company_deposits').select('*').order('created_at', { ascending: false }),
    ]);

    if (appError) return NextResponse.json({ error: appError.message }, { status: 400 });
    if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 400 });
    if (depositsError) return NextResponse.json({ error: depositsError.message }, { status: 400 });

    return NextResponse.json({
      companies: apps || [],
      settings: settingsData || [],
      deposits: depositsData || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load fee configuration data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { response } = await getAuthorizedUser(request);
    if (response) return response;

    const body = (await request.json()) as SaveConfigurationBody;
    const companyId = String(body.companyId || '').trim();
    const startDate = String(body.startDate || '').trim();
    const monthlyFee = Number(body.monthlyFee ?? 0);
    const refundableDeposit = Number(body.refundableDeposit ?? 0);
    const dueDay = Number(body.dueDay ?? 5);
    const gracePeriodDays = Number(body.gracePeriodDays ?? 0);
    const depositStatus = String(body.depositStatus || 'pending');
    const status = String(body.status || 'active');
    const depositCollectionDate = body.depositCollectionDate || null;

    if (!companyId || !startDate) {
      return NextResponse.json(
        { error: 'Select a company and provide a fee start date.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
      return NextResponse.json({ error: 'Monthly fee must be zero or more.' }, { status: 400 });
    }

    if (!Number.isFinite(refundableDeposit) || refundableDeposit < 0) {
      return NextResponse.json(
        { error: 'Refundable deposit must be zero or more.' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
      return NextResponse.json({ error: 'Due day must be between 1 and 28.' }, { status: 400 });
    }

    if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0) {
      return NextResponse.json(
        { error: 'Grace period must be zero days or more.' },
        { status: 400 }
      );
    }

    if (!depositStatuses.has(depositStatus)) {
      return NextResponse.json({ error: 'Invalid deposit status.' }, { status: 400 });
    }

    if (!settingStatuses.has(status)) {
      return NextResponse.json({ error: 'Invalid plan status.' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    const { data: company, error: companyError } = await supabaseAdmin
      .from('applications')
      .select('id, status')
      .eq('id', companyId)
      .maybeSingle();

    if (companyError) {
      return NextResponse.json({ error: companyError.message }, { status: 400 });
    }

    if (!company || String(company.status || '').toLowerCase() !== 'approved') {
      return NextResponse.json(
        { error: 'Fee configuration can be saved only for approved companies.' },
        { status: 400 }
      );
    }

    const { error: settingsError } = await supabaseAdmin
      .from('incubation_fee_settings')
      .upsert(
        {
          company_id: companyId,
          monthly_fee: monthlyFee,
          refundable_deposit: refundableDeposit,
          deposit_collection_date: depositCollectionDate,
          deposit_status: depositStatus,
          start_date: startDate,
          due_day: dueDay,
          grace_period_days: gracePeriodDays,
          status,
        },
        { onConflict: 'company_id' }
      );

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 400 });
    }

    const { data: existingDeposit, error: existingDepositError } = await supabaseAdmin
      .from('company_deposits')
      .select('amount_collected, amount_refunded, collection_date, refund_date, remarks')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existingDepositError) {
      return NextResponse.json({ error: existingDepositError.message }, { status: 400 });
    }

    const collected = Number(existingDeposit?.amount_collected || 0);
    const refunded = Number(existingDeposit?.amount_refunded || 0);
    const balance = Math.max(refundableDeposit - collected + refunded, 0);

    const { error: depositError } = await supabaseAdmin
      .from('company_deposits')
      .upsert(
        {
          company_id: companyId,
          deposit_amount: refundableDeposit,
          amount_collected: collected,
          amount_refunded: refunded,
          balance_amount: balance,
          collection_date: depositCollectionDate || existingDeposit?.collection_date || null,
          refund_date: existingDeposit?.refund_date || null,
          status: depositStatus,
          remarks: existingDeposit?.remarks || null,
        },
        { onConflict: 'company_id' }
      );

    if (depositError) {
      return NextResponse.json({ error: depositError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
