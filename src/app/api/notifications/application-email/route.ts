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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ApplicationEmailPayload;
    const { email, leadName, businessName, applicationNumber, status } = body;

    if (!email || !leadName || !businessName || !applicationNumber || !status) {
      return NextResponse.json(
        { error: 'Missing required fields for email notification.' },
        { status: 400 }
      );
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const mailFrom = process.env.MAIL_FROM || smtpUser;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !mailFrom) {
      return NextResponse.json(
        { error: 'Email service is not configured on server.' },
        { status: 500 }
      );
    }

    const parsedPort = parseInt(smtpPort, 10);
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
