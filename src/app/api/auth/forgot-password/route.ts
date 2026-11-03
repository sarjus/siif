import { createHash, randomBytes, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { getAccountByEmail } from '@/lib/server-auth';
import { getMysqlPool } from '@/lib/mysql';

const RESET_TOKEN_TTL_MINUTES = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: { message: 'Email is required.' } }, { status: 400 });

    const account = await getAccountByEmail(email);
    if (!account) return NextResponse.json({ success: true });

    const [rateRows] = await getMysqlPool().execute(
      'SELECT COUNT(*) AS `count` FROM `password_resets` WHERE `user_id` = ? AND `created_at` > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)',
      [account.id]
    ) as [Array<{ count: number | string }>, unknown];
    if (Number(rateRows[0]?.count || 0) >= 3) return NextResponse.json({ success: true });

    const smtpHost = (process.env.SMTP_HOST || '').trim();
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').trim();
    if (!smtpHost || !smtpUser || !smtpPass || !Number.isInteger(smtpPort)) {
      throw new Error('Password reset email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await getMysqlPool().execute(
      'INSERT INTO `password_resets` (`id`, `user_id`, `token_hash`, `expires_at`) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))',
      [randomUUID(), account.id, tokenHash, RESET_TOKEN_TTL_MINUTES]
    );

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/+$/, '');
    const resetUrl = `${appUrl}/login?recovery=${encodeURIComponent(token)}`;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: (process.env.MAIL_FROM || smtpUser).trim(),
      to: email,
      subject: 'Reset your SIIF portal password',
      text: `Use this link within ${RESET_TOKEN_TTL_MINUTES} minutes to reset your SIIF portal password:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Could not send password reset email.' } },
      { status: 500 }
    );
  }
}
