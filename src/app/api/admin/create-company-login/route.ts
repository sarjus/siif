import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createMysqlClient } from '@/lib/mysql';
import {
  createUserAccount,
  getAccountByEmail,
  recreateUserAccount,
  requireAdmin,
} from '@/lib/server-auth';

const generateTemporaryPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  return Array.from({ length: 18 }, () => alphabet[randomInt(alphabet.length)]).join('');
};

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;

    const body = await request.json() as {
      applicationId?: string;
      email?: string;
      leadName?: string;
      businessName?: string;
      forceRecreate?: boolean;
    };
    const { applicationId, email, leadName, businessName, forceRecreate } = body;

    if (!applicationId || !email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'applicationId and email are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    const database = createMysqlClient();
    const { data: application, error: applicationError } = await database
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

    const metadata = {
      role: 'company',
      application_id: applicationId,
      business_name: businessName || null,
      lead_name: leadName || null,
    };
    const temporaryPassword = generateTemporaryPassword();
    const existingAccount = await getAccountByEmail(normalizedEmail);

    if (existingAccount && existingAccount.role !== 'company') {
      return NextResponse.json(
        { error: 'Cannot create a company login because this email belongs to a different account type.' },
        { status: 409 }
      );
    }
    if (existingAccount && forceRecreate !== true) {
      return NextResponse.json(
        { error: 'A login already exists for this email. Recreate it to issue a new temporary password.' },
        { status: 409 }
      );
    }

    let userId: string;
    if (existingAccount) {
      await recreateUserAccount({
          id: existingAccount.id,
          email: normalizedEmail,
          password: temporaryPassword,
          role: 'company',
          metadata,
      });
      userId = existingAccount.id;
    } else {
      userId = await createUserAccount({
          email: normalizedEmail,
          password: temporaryPassword,
          role: 'company',
          metadata,
          mustResetPassword: true,
        });
    }

    return NextResponse.json({
      success: true,
      recreated: Boolean(existingAccount),
      userId,
      defaultPassword: temporaryPassword,
    });
  } catch (error) {
    console.error('Failed to create company login:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
