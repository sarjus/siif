import { NextRequest, NextResponse } from "next/server";
import nodemailer, { Transporter } from "nodemailer";

type ApplicationEmailPayload = {
  email: string;
  leadName: string;
  businessName: string;
  applicationNumber: string;
  status: "draft" | "submitted";
};

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export async function POST(request: NextRequest) {
  try {
    const body: ApplicationEmailPayload = await request.json();

    const { email, leadName, businessName, applicationNumber, status } = body;

    if (
      !email ||
      !leadName ||
      !businessName ||
      !applicationNumber ||
      !status
    ) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const mailFrom =
      process.env.MAIL_FROM ||
      `SIIF Incubator <${smtpUser}>`;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { error: "SMTP configuration missing." },
        { status: 500 }
      );
    }

    const transporter: Transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const safeLeadName = escapeHtml(leadName);
    const safeBusinessName = escapeHtml(businessName);
    const safeApplicationNumber = escapeHtml(applicationNumber);

    const isDraft = status === "draft";

    const subject = isDraft
      ? `SIIF Draft Saved - ${applicationNumber}`
      : `SIIF Application Submitted - ${applicationNumber}`;

    const message = isDraft
      ? "Your application has been saved as draft. You can continue anytime using your Application Number and Mobile Number."
      : "Your application has been submitted successfully. You can track status anytime using your Application Number and Mobile Number.";

    const text = `
Dear ${leadName},

Startup: ${businessName}
Application Number: ${applicationNumber}

${message}

Thank you,
SIIF Team
`;

    const html = `
<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222;">
  <h2>SIIF Incubator</h2>
  <p>Dear ${safeLeadName},</p>

  <p>
    <strong>Startup:</strong> ${safeBusinessName}<br>
    <strong>Application Number:</strong> ${safeApplicationNumber}
  </p>

  <p>${escapeHtml(message)}</p>

  <p>Thank you,<br><strong>SIIF Team</strong></p>
</div>
`;

    await transporter.sendMail({
      from: mailFrom,
      to: email,
      subject,
      text,
      html,
    });

    return NextResponse.json({
      success: true,
      message: "Email sent successfully.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to send email.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
