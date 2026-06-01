import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAdmin } from '@/lib/server-auth';

type CompanyLoginEmailPayload = {
  email: string;
  leadName: string;
  businessName: string;
  username: string;
  temporaryPassword: string;
  loginUrl?: string;
};

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');

const sanitizeEnv = (value?: string | null) => (value ?? '').trim();

const stripWrappingQuotes = (value: string) => value.replace(/^['"]+|['"]+$/g, '');

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;

    const body = (await request.json()) as CompanyLoginEmailPayload;
    const { email, leadName, businessName, username, temporaryPassword, loginUrl } = body;

    if (!email || !leadName || !businessName || !username || !temporaryPassword) {
      return NextResponse.json(
        { error: 'Missing required fields for company login email notification.' },
        { status: 400 }
      );
    }

    const smtpHost = sanitizeEnv(process.env.SMTP_HOST);
    const smtpPort = sanitizeEnv(process.env.SMTP_PORT);
    const smtpUser = sanitizeEnv(process.env.SMTP_USER);
    const smtpPass = sanitizeEnv(process.env.SMTP_PASS);
    const mailFromRaw = sanitizeEnv(process.env.MAIL_FROM) || smtpUser;
    const mailFrom = stripWrappingQuotes(mailFromRaw);

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !mailFrom) {
      return NextResponse.json(
        { error: 'Email service is not configured on server.' },
        { status: 500 }
      );
    }

    const parsedPort = parseInt(smtpPort, 10);
    if (Number.isNaN(parsedPort)) {
      return NextResponse.json(
        { error: 'Invalid SMTP_PORT value in server configuration.' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parsedPort,
      secure: parsedPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const resolvedLoginUrl = loginUrl || `${request.nextUrl.origin}/login`;

    const safeLeadName = escapeHtml(leadName);
    const safeBusinessName = escapeHtml(businessName);
    const safeUsername = escapeHtml(username);
    const safeTemporaryPassword = escapeHtml(temporaryPassword);
    const safeLoginUrl = escapeHtml(resolvedLoginUrl);

    const subject = 'SIIF Company Portal Access Approved';

    const text = [
      `Dear ${leadName},`,
      '',
      `${businessName} has been approved for SIIF company portal access.`,
      '',
      `Username: ${username}`,
      `Temporary Password: ${temporaryPassword}`,
      `Login URL: ${resolvedLoginUrl}`,
      '',
      'You will be required to reset your password on first login.',
      '',
      'Thank you,',
      'SIIF Team',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <p>Dear ${safeLeadName},</p>
        <p>
          <strong>${safeBusinessName}</strong> has been approved for SIIF company portal access.
        </p>
        <p>
          <strong>Username:</strong> ${safeUsername}<br/>
          <strong>Temporary Password:</strong> ${safeTemporaryPassword}<br/>
          <strong>Login URL:</strong> <a href="${safeLoginUrl}">${safeLoginUrl}</a>
        </p>
        <p>You will be required to reset your password on first login.</p>
        <p>Thank you,<br/>SIIF Team</p>
      </div>
    `;

    await transporter.sendMail({
      from: mailFrom,
      to: email,
      subject,
      text,
      html,
    });

    return NextResponse.json({ sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send company login email.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
