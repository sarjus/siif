import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/lib/mysql';
import { requireAdmin } from '@/lib/server-auth';

const COLUMNS = 'id, business_name, lead_name, email, mobile_phone, postal_address, city, state, sector_domain, stage_of_startup, legal_status, business_description, status';

const toForm = (row: RowDataPacket) => {
  let sector = '';
  try {
    const parsed = typeof row.sector_domain === 'string' ? JSON.parse(row.sector_domain) : row.sector_domain;
    sector = Array.isArray(parsed) ? parsed.join(', ') : '';
  } catch {
    sector = '';
  }
  return {
    businessName: row.business_name || '',
    leadName: row.lead_name || '',
    email: row.email || '',
    mobilePhone: row.mobile_phone || '',
    postalAddress: row.postal_address || '',
    city: row.city || '',
    state: row.state || '',
    sector,
    stageOfStartup: row.stage_of_startup || '',
    legalStatus: row.legal_status || '',
    businessDescription: row.business_description || '',
  };
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;
    const { id } = await params;
    const [rows] = await getMysqlPool().execute<RowDataPacket[]>(
      `SELECT ${COLUMNS} FROM \`applications\` WHERE \`id\` = ? AND \`status\` = 'approved' LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Approved company not found.' }, { status: 404 });
    return NextResponse.json({ company: toForm(rows[0]) });
  } catch (error) {
    console.error('Failed to load company:', error);
    return NextResponse.json({ error: 'Could not load the company.' }, { status: 500 });
  }
}

const FIELD_LIMITS: Record<string, number> = {
  businessName: 255, leadName: 255, email: 320, mobilePhone: 50, city: 150, state: 150,
  sector: 255, stageOfStartup: 100, legalStatus: 100, postalAddress: 5000, businessDescription: 10000,
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;
    const { id } = await params;

    const raw: unknown = await request.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'A company details object is required.' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const field of Object.keys(FIELD_LIMITS)) {
      const value = body[field];
      if (value === undefined || value === null) { values[field] = ''; continue; }
      if (typeof value !== 'string') {
        return NextResponse.json({ error: 'All company fields must be text.' }, { status: 400 });
      }
      values[field] = value.trim();
      if (values[field].length > FIELD_LIMITS[field]) {
        return NextResponse.json({ error: 'One or more fields exceed the allowed length.' }, { status: 400 });
      }
    }
    values.email = values.email.toLowerCase();
    if (!values.businessName || !values.leadName || !values.email) {
      return NextResponse.json({ error: 'Company name, contact person, and email are required.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const connection = await getMysqlPool().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT `id`, `email` FROM `applications` WHERE `id` = ? AND `status` = 'approved' LIMIT 1 FOR UPDATE",
        [id]
      );
      if (rows.length === 0) {
        await connection.rollback();
        return NextResponse.json({ error: 'Approved company not found.' }, { status: 404 });
      }
      const oldEmail = String(rows[0].email || '').trim().toLowerCase();
      const emailChanged = oldEmail !== values.email;

      if (emailChanged) {
        const [clash] = await connection.execute<RowDataPacket[]>(
          'SELECT `id` FROM `applications` WHERE LOWER(`email`) = ? AND `id` <> ? LIMIT 1',
          [values.email, id]
        );
        const [accountClash] = await connection.execute<RowDataPacket[]>(
          'SELECT `id` FROM `auth_users` WHERE `email` = ? LIMIT 1',
          [values.email]
        );
        if (clash.length > 0 || accountClash.length > 0) {
          await connection.rollback();
          return NextResponse.json({ error: 'Another application or account already uses this email.' }, { status: 409 });
        }
      }

      await connection.execute(
        `UPDATE \`applications\` SET \`business_name\` = ?, \`lead_name\` = ?, \`email\` = ?, \`mobile_phone\` = ?,
           \`postal_address\` = ?, \`city\` = ?, \`state\` = ?, \`sector_domain\` = ?, \`stage_of_startup\` = ?,
           \`legal_status\` = ?, \`business_description\` = ? WHERE \`id\` = ?`,
        [
          values.businessName, values.leadName, values.email, values.mobilePhone || null,
          values.postalAddress || null, values.city || null, values.state || null,
          values.sector ? JSON.stringify([values.sector]) : null,
          values.stageOfStartup || null, values.legalStatus || null, values.businessDescription || null, id,
        ]
      );

      // Keep the company login in sync with the profile.
      await connection.execute(
        `UPDATE \`auth_users\`
         SET \`email\` = ?,
             \`metadata\` = JSON_SET(COALESCE(\`metadata\`, JSON_OBJECT()), '$.business_name', ?, '$.lead_name', ?)
         WHERE \`role\` = 'company' AND (\`email\` = ? OR JSON_UNQUOTE(JSON_EXTRACT(\`metadata\`, '$.application_id')) = ?)`,
        [values.email, values.businessName, values.leadName, oldEmail, id]
      );
      if (emailChanged) {
        await connection.execute(
          'DELETE FROM `auth_sessions` WHERE `user_id` IN (SELECT `id` FROM `auth_users` WHERE `email` = ?)',
          [values.email]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return NextResponse.json({
      success: true,
      application: {
        id,
        business_name: values.businessName,
        lead_name: values.leadName,
        email: values.email,
        mobile_phone: values.mobilePhone || null,
      },
    });
  } catch (error) {
    console.error('Failed to update company:', error);
    return NextResponse.json({ error: 'Could not update the company. Please try again.' }, { status: 500 });
  }
}
