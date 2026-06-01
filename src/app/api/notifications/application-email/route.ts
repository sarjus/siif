import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

type ApplicationEmailPayload = {
  email: string;
  leadName: string;
  businessName: string;
  applicationNumber: string;
  status: 'draft' | 'submitted';
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

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitBucket = new Map<string, { count: number; resetAt: number }>();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getClientKey = (request: NextRequest) =>
  (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown')
    .split(',')[0]
    .trim();

const isRateLimited = (request: NextRequest) => {
  const key = getClientKey(request);
  const now = Date.now();
  const current = rateLimitBucket.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBucket.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
};

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(request)) {
      return NextResponse.json({ error: 'Too many email requests.' }, { status: 429 });
    }

    const body = (await request.json()) as ApplicationEmailPayload;
    const { email, leadName, businessName, applicationNumber, status } = body;

    if (!email || !leadName || !businessName || !applicationNumber || !status) {
      return NextResponse.json(
        { error: 'Missing required fields for email notification.' },
        { status: 400 }
      );
    }

    if (!emailRegex.test(email) || !['draft', 'submitted'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid email notification payload.' },
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

    const safeLeadName = escapeHtml(leadName);
    const safeBusinessName = escapeHtml(businessName);
    const safeApplicationNumber = escapeHtml(applicationNumber);

    const isDraft = status === 'draft';
    const subject = isDraft
      ? `SIIF Draft Saved - ${safeApplicationNumber}`
      : `SIIF Application Submitted - ${safeApplicationNumber}`;

    const statusLine = isDraft
      ? 'Your application has been saved as draft. You can resume it anytime using your Application Number and Mobile Phone.'
      : 'Your application has been submitted successfully. You can track status anytime using your Application Number and Mobile Phone.';

    const text = [
      `Dear ${leadName},`,
      '',
      `Startup: ${businessName}`,
      `Application Number: ${applicationNumber}`,
      '',
      statusLine,
      '',
      'Thank you,',
      'SIIF Team',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <p>Dear ${safeLeadName},</p>
        <p><strong>Startup:</strong> ${safeBusinessName}<br/>
        <strong>Application Number:</strong> ${safeApplicationNumber}</p>
        <p>${escapeHtml(statusLine)}</p>
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
    const message = error instanceof Error ? error.message : 'Failed to send email.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
