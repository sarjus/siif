import { randomInt, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/lib/mysql';
import { hashPassword, requireAdmin } from '@/lib/server-auth';

const generateTemporaryPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  return Array.from({ length: 18 }, () => alphabet[randomInt(alphabet.length)]).join('');
};

type CreateCompanyBody = {
  businessName?: string;
  leadName?: string;
  email?: string;
  mobilePhone?: string;
  postalAddress?: string;
  city?: string;
  state?: string;
  sector?: string;
  stageOfStartup?: string;
  legalStatus?: string;
  businessDescription?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (response) return response;

    const requestBody: unknown = await request.json();
    if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
      return NextResponse.json({ error: 'A company details object is required.' }, { status: 400 });
    }
    const body = requestBody as CreateCompanyBody;
    const optionalValues = [
      body.mobilePhone,
      body.postalAddress,
      body.city,
      body.state,
      body.sector,
      body.stageOfStartup,
      body.legalStatus,
      body.businessDescription,
    ];
    if (
      typeof body.businessName !== 'string'
      || typeof body.leadName !== 'string'
      || typeof body.email !== 'string'
      || optionalValues.some((value) => value !== undefined && value !== null && typeof value !== 'string')
    ) {
      return NextResponse.json({ error: 'Company name, contact person, and email must be text.' }, { status: 400 });
    }

    const businessName = body.businessName?.trim();
    const leadName = body.leadName?.trim();
    const email = body.email?.trim().toLowerCase();
    const mobilePhone = body.mobilePhone?.trim() || null;
    const postalAddress = body.postalAddress?.trim() || null;
    const city = body.city?.trim() || null;
    const state = body.state?.trim() || null;
    const sector = body.sector?.trim() || null;
    const stageOfStartup = body.stageOfStartup?.trim() || null;
    const legalStatus = body.legalStatus?.trim() || null;
    const businessDescription = body.businessDescription?.trim() || null;

    if (!businessName || !leadName || !email) {
      return NextResponse.json(
        { error: 'Company name, contact person, and email are required.' },
        { status: 400 }
      );
    }
    if (businessName.length > 255 || leadName.length > 255 || email.length > 320) {
      return NextResponse.json({ error: 'One or more fields exceed the allowed length.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (mobilePhone && mobilePhone.length > 50) {
      return NextResponse.json({ error: 'Phone number must be 50 characters or fewer.' }, { status: 400 });
    }
    if ((city && city.length > 150) || (state && state.length > 150)) {
      return NextResponse.json({ error: 'City and state must be 150 characters or fewer.' }, { status: 400 });
    }
    if ((stageOfStartup && stageOfStartup.length > 100) || (legalStatus && legalStatus.length > 100)) {
      return NextResponse.json({ error: 'Startup stage and legal status must be 100 characters or fewer.' }, { status: 400 });
    }
    if ((sector && sector.length > 255) || (postalAddress && postalAddress.length > 5000)
      || (businessDescription && businessDescription.length > 10000)) {
      return NextResponse.json({ error: 'Sector, address, or business description exceeds the allowed length.' }, { status: 400 });
    }

    const applicationId = randomUUID();
    const userId = randomUUID();
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const pool = getMysqlPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [existingApplications] = await connection.execute<RowDataPacket[]>(
        'SELECT `id` FROM `applications` WHERE LOWER(`email`) = ? LIMIT 1 FOR UPDATE',
        [email]
      );
      if (existingApplications.length > 0) {
        await connection.rollback();
        return NextResponse.json(
          { error: 'An application already exists for this email. Use the existing application to create its company login.' },
          { status: 409 }
        );
      }

      const [existingAccounts] = await connection.execute<RowDataPacket[]>(
        'SELECT `id` FROM `auth_users` WHERE `email` = ? LIMIT 1 FOR UPDATE',
        [email]
      );
      if (existingAccounts.length > 0) {
        await connection.rollback();
        return NextResponse.json(
          { error: 'An account already exists for this email. Use a different email or resolve the existing account first.' },
          { status: 409 }
        );
      }

      await connection.execute(
        `INSERT INTO \`applications\`
          (\`id\`, \`business_name\`, \`lead_name\`, \`email\`, \`mobile_phone\`, \`postal_address\`,
           \`city\`, \`state\`, \`sector_domain\`, \`stage_of_startup\`, \`legal_status\`,
           \`business_description\`, \`status\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
        [
          applicationId,
          businessName,
          leadName,
          email,
          mobilePhone,
          postalAddress,
          city,
          state,
          sector ? JSON.stringify([sector]) : null,
          stageOfStartup,
          legalStatus,
          businessDescription,
        ]
      );
      await connection.execute(
        'INSERT INTO `application_status_history` (`id`, `application_id`, `old_status`, `new_status`, `notes`, `changed_by`) VALUES (?, ?, NULL, ?, ?, ?)',
        [randomUUID(), applicationId, 'approved', 'Company added by admin.', user?.email || null]
      );
      await connection.execute(
        'INSERT INTO `auth_users` (`id`, `email`, `role`, `password_hash`, `metadata`, `must_reset_password`) VALUES (?, ?, ?, ?, ?, TRUE)',
        [
          userId,
          email,
          'company',
          passwordHash,
          JSON.stringify({
            application_id: applicationId,
            business_name: businessName,
            lead_name: leadName,
          }),
        ]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const createdAt = new Date().toISOString();
    return NextResponse.json({
      success: true,
      application: {
        id: applicationId,
        business_name: businessName,
        lead_name: leadName,
        email,
        mobile_phone: mobilePhone,
        status: 'approved',
        submitted_at: createdAt,
        created_at: createdAt,
      },
      temporaryPassword,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create approved company:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'An account already exists for this email. Use the existing application or account.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Could not create the company. Please try again.' }, { status: 500 });
  }
}
