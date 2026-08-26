/**
 * Email notification service.
 *
 * Development mode: logs emails to console.
 * Production mode: ready to plug in SMTP via nodemailer or a provider SDK
 * (SendGrid/SES). Configure SMTP_* env vars and swap in the transport below.
 */

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const isDev = process.env.NODE_ENV === 'development';

export async function sendMail(payload: MailPayload): Promise<void> {
  if (!process.env.SMTP_HOST || isDev) {
    // Dev fallback: log instead of sending so flows are testable without SMTP
    console.log('📧 [DEV EMAIL] -------------------------------');
    console.log(`To:      ${payload.to}`);
    console.log(`Subject: ${payload.subject}`);
    console.log(`${payload.text}`);
    console.log('----------------------------------------------');
    return;
  }

  // TODO(production): replace with real transport once SMTP creds exist:
  // import nodemailer from 'nodemailer';
  // const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, ... });
  // await transport.sendMail({ from: process.env.SMTP_USER, ...payload });
  throw new Error('SMTP transport not configured - set SMTP_HOST or run in development mode');
}

export async function sendVerificationEmail(to: string, token: string, baseUrl: string): Promise<void> {
  const url = `${baseUrl}/verify-email?token=${token}`;
  await sendMail({
    to,
    subject: 'Verify your email address',
    text: `Welcome! Please verify your email by visiting: ${url}\n\nThis link expires in 24 hours.`,
    html: `<h2>Welcome!</h2><p>Please verify your email by <a href="${url}">clicking here</a>.</p><p>This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string, baseUrl: string): Promise<void> {
  const url = `${baseUrl}/reset-password?token=${token}`;
  await sendMail({
    to,
    subject: 'Reset your password',
    text: `You requested a password reset. Visit this link to choose a new password: ${url}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore it.`,
    html: `<h2>Password Reset</h2><p>You requested a password reset.</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
  });
}
