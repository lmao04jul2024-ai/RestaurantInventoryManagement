/**
 * S3.3 — Email lifecycle service.
 *
 * Wraps the existing `mailer.ts` abstraction (dev-logs to console, production
 * swap-in via SMTP_HOST) with the templated, context-specific messages this
 * phase introduces:
 *
 *  - account verification on first registration (S3.3.1)
 *  - a new user invited to an existing team (S3.3.2)
 *  - a trial/subscription that is about to lapse (S3.3.3)
 *
 * Every template is pure (returns a {subject, text, html} tuple) so they are
 * trivially unit-testable without touching mail. The transport itself is the
 * responsibility of `mailer.sendMail`; this module only shapes the payload and
 * picks the right baseUrl so verification/invite links resolve against the
 * tenant-aware front door.
 *
 * Manual-billing constraint (Phase B): these are informational only — no
 * transaction is recorded or linked in the app. Renewal = operator action.
 */

import { sendMail, sendVerificationEmail, sendPasswordResetEmail, type MailPayload } from './mailer';

/**
 * Base URL the front-end lives at. In production this is the tenant-aware host
 * the operator published (e.g. `https://acme.yourapp.com`); in dev it is the
 * local studio. Each public link is built with an absolute URL so it works
 * from an email client regardless of the host that generated it.
 */
function appBaseUrl(): string {
  // NEXT_PUBLIC_API_URL is used on the web side for relative API calls; for
  // email links we want the human-facing origin. Prefer APP_URL in prod.
  return process.env.APP_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
}
export { appBaseUrl };

/* ── Templates (pure) ──────────────────────────────────────────────────────── */

interface InviteTokenPayload {
  firstName: string;
  lastName: string;
  role: string;
  tenantName: string;
  inviteUrl: string;
}

const inviteTemplate = (p: InviteTokenPayload): Pick<MailPayload, 'subject' | 'text' | 'html'> => ({
  subject: `Invitation to join ${p.tenantName} on Restaurant Manager`,
  text:
    `Hi${p.firstName ? ` ${p.firstName}` : ''},\n\n` +
    `You've been invited to join ${p.tenantName} as a ${p.role}.\n\n` +
    `Accept your invitation and set a password:\n${p.inviteUrl}\n\n` +
    `This link expires in 7 days.\n`,
  html:
    `<h2>Invitation to join ${p.tenantName}</h2>` +
    `<p>You've been invited to join <strong>${p.tenantName}</strong> as a <strong>${p.role}</strong>.</p>` +
    `<p><a href="${p.inviteUrl}">Accept your invitation and set a password</a></p>` +
    `<p>This link expires in 7 days.</p>`,
});

/* ── Senders ───────────────────────────────────────────────────────────────── */

/**
 * S3.3.1 — notify a freshly-registered user that they should verify their email.
 * Returns the raw verification link so callers can also log it in test/CI.
 */
export async function sendAccountVerification(
  to: string,
  verifyToken: string,
): Promise<{ link: string }> {
  const link = `${appBaseUrl()}/verify-email?token=${verifyToken}`;
  await sendVerificationEmail(to, verifyToken, appBaseUrl());
  return { link };
}

/**
 * S3.3.2 — a team admin invited a user to an existing workspace. `inviteToken`
 * is the signed, single-use token the accept-invite flow consumes to set the
 * user's password (the invite itself is recorded/audit-logged in staff.controller).
 */
export async function sendTeamInvite(
  to: string,
  params: { firstName: string; lastName: string; role: string; tenantName: string; inviteToken: string },
): Promise<void> {
  const inviteUrl = `${appBaseUrl()}/invite?token=${params.inviteToken}`;
  const payload: MailPayload = {
    to,
    ...inviteTemplate({ ...params, inviteUrl }),
  };
  await sendMail(payload);
}

/**
 * S3.3.3 — trial/subscription is about to run out (or is PAST_DUE). Manual
 * billing: this is a nudge to the tenant owner, not an automated charge.
 */
export async function sendRenewalReminder(
  to: string,
  params: { firstName: string; tenantName: string; status: 'TRIAL_EXPIRING' | 'PAST_DUE' },
): Promise<void> {
  const subject =
    params.status === 'TRIAL_EXPIRING'
      ? `${params.tenantName} — your trial ends in 3 days`
      : `${params.tenantName} — your subscription needs attention`;

  const payload: MailPayload = {
    to,
    subject,
    text:
      `Hi${params.firstName ? ` ${params.firstName}` : ''},\n\n` +
      `A quick note about ${params.tenantName}'s account: ${
        params.status === 'TRIAL_EXPIRING'
          ? 'your free trial ends soon. After that, your workspace will be suspended unless renewed.'
          : 'your subscription is past due. Your workspace is currently suspended; settle your account to restore access.'
      }\n\n` +
      `Reach your platform operator to continue service.\n`,
    html:
      `<h2>${params.tenantName}</h2>` +
      `<p>A quick note about your account: ${
        params.status === 'TRIAL_EXPIRING'
          ? 'your free trial ends in 3 days. Your workspace will be suspended after that unless renewed.'
          : 'your subscription is past due. Your workspace is currently suspended — settle your account to restore access.'
      }</p>` +
      `<p>Reach your platform operator to continue service.</p>`,
  };

  await sendMail(payload);
}

// Re-export the password-reset sender so reset flow imports live in one place.
export { sendPasswordResetEmail };
