import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_COMPANY_PASSWORD = 'SIIF@2026!';

const isAlreadyExistsError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('already') || normalized.includes('registered');
};

const findAuthUserByEmail = async (
  supabaseAdmin: {
    auth: {
      admin: {
        listUsers: (params: { page: number; perPage: number }) => Promise<{
          data: {
            users: Array<{
              id: string;
              email?: string | null;
              user_metadata?: Record<string, unknown> | null;
            }>;
            nextPage: number | null;
          };
          error: { message: string } | null;
        }>;
      };
    };
  },
  normalizedEmail: string
) => {
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = (data.users || []).find(
      (user) => (user.email || '').trim().toLowerCase() === normalizedEmail
    );

    if (match) return match;
    if (!data.nextPage) break;
    page = data.nextPage;
  }

  return null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicationId, email, leadName, businessName, forceRecreate } = body as {
      applicationId?: string;
      email?: string;
      leadName?: string;
      businessName?: string;
      forceRecreate?: boolean;
    };

    if (!applicationId || !email) {
      return NextResponse.json(
        { error: 'applicationId and email are required' },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'Server configuration error: missing service role key' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const normalizedEmail = email.trim().toLowerCase();

    // Only approved applications should get company portal access.
    const { data: application, error: applicationError } = await supabaseAdmin
      .from('applications')
      .select('id, email, status')
      .eq('id', applicationId)
      .maybeSingle();

    if (applicationError) {
      return NextResponse.json({ error: applicationError.message }, { status: 400 });
    }

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if ((application.status || '').toLowerCase() !== 'approved') {
      return NextResponse.json(
        { error: 'Company login can be created only for approved applications' },
        { status: 400 }
      );
    }

    if ((application.email || '').trim().toLowerCase() !== normalizedEmail) {
      return NextResponse.json(
        { error: 'Application email mismatch. Use the same email as the application.' },
        { status: 400 }
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: DEFAULT_COMPANY_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: 'company',
        application_id: applicationId,
        business_name: businessName || null,
        lead_name: leadName || null,
        must_reset_password: true,
      },
    });

    if (userError) {
      if (isAlreadyExistsError(userError.message || '')) {
        if (!forceRecreate) {
        return NextResponse.json(
          {
            error:
              'A login already exists for this email. If needed, reset the password in Supabase Auth users.',
          },
          { status: 409 }
        );
        }

        const existingUser = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);

        if (!existingUser) {
          return NextResponse.json(
            { error: 'Existing user could not be located for recreation.' },
            { status: 404 }
          );
        }

        const existingRole = String(existingUser.user_metadata?.role || '');
        if (existingRole && existingRole !== 'company') {
          return NextResponse.json(
            {
              error:
                'Cannot recreate login because this email belongs to a non-company account.',
            },
            { status: 409 }
          );
        }

        const { data: updatedData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          {
            password: DEFAULT_COMPANY_PASSWORD,
            email_confirm: true,
            user_metadata: {
              ...(existingUser.user_metadata || {}),
              role: 'company',
              application_id: applicationId,
              business_name: businessName || null,
              lead_name: leadName || null,
              must_reset_password: true,
              company_login_recreated_at: new Date().toISOString(),
            },
          }
        );

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          recreated: true,
          userId: updatedData.user.id,
          defaultPassword: DEFAULT_COMPANY_PASSWORD,
        });
      }

      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      recreated: false,
      userId: userData.user.id,
      defaultPassword: DEFAULT_COMPANY_PASSWORD,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
