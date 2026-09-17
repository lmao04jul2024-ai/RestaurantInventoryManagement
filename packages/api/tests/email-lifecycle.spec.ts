/**
 * S3.3 — Email lifecycle service tests.
 *
 * The templates are pure and the transport is the dev-logging `sendMail` from
 * `mailer.ts`; we mock `sendMail` to assert WHAT gets sent (subject/to/html)
 * without depending on console capture or real SMTP.
 */

jest.mock('../src/services/mailer', () => ({
  __esModule: true,
  sendMail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

import { sendMail, sendVerificationEmail, sendPasswordResetEmail } from '../src/services/mailer';
import {
  sendAccountVerification,
  sendTeamInvite,
  sendRenewalReminder,
} from '../src/services/email-lifecycle';

const sendMailMock = sendMail as jest.MockedFunction<typeof sendMail>;
const verifyMock = sendVerificationEmail as jest.MockedFunction<typeof sendVerificationEmail>;
const resetMock = sendPasswordResetEmail as jest.MockedFunction<typeof sendPasswordResetEmail>;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.APP_URL = 'https://app.example.com';
});

describe('S3.3 — sendAccountVerification', () => {
  it('delegates to the mailer with an absolute verification link', async () => {
    await sendAccountVerification('ada@example.com', 'tok-abc');

    expect(verifyMock).toHaveBeenCalledTimes(1);
    const [to, token, baseUrl] = verifyMock.mock.calls[0];
    expect(to).toBe('ada@example.com');
    expect(token).toBe('tok-abc');
    expect(baseUrl).toBe('https://app.example.com');
  });

  it('returns the link for callers that want to log it in dev', async () => {
    const { link } = await sendAccountVerification('ada@example.com', 'tok-xyz');
    expect(link).toBe('https://app.example.com/verify-email?token=tok-xyz');
  });

  it('defaults to localhost when APP_URL is unset (dev)', async () => {
    delete process.env.APP_URL;
    await sendAccountVerification('ada@example.com', 'tok');
    expect(verifyMock.mock.calls[0][2]).toBe('http://localhost:3000');
  });
});

describe('S3.3 — sendTeamInvite', () => {
  it('builds a tokenized invite link and sends a templated email', async () => {
    await sendTeamInvite('dev@example.com', {
      firstName: 'Dev',
      lastName: 'Ops',
      role: 'KITCHEN',
      tenantName: 'The Bloom Bistro',
      inviteToken: 'invite-123',
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const payload = sendMailMock.mock.calls[0][0];
    expect(payload.to).toBe('dev@example.com');
    expect(payload.subject).toBe('Invitation to join The Bloom Bistro on Restaurant Manager');
    expect(payload.html).toContain('https://app.example.com/invite?token=invite-123');
    expect(payload.html).toContain('The Bloom Bistro');
    expect(payload.html).toContain('KITCHEN');
    expect(payload.text).toContain('invite-123');
  });
});

describe('S3.3 — sendRenewalReminder', () => {
  it('nudges the owner about a trial ending soon', async () => {
    await sendRenewalReminder('owner@example.com', {
      firstName: 'Owner',
      tenantName: 'Acme Eats',
      status: 'TRIAL_EXPIRING',
    });

    const { subject, html } = sendMailMock.mock.calls[0][0];
    expect(subject).toBe('Acme Eats — your trial ends in 3 days');
    expect(html).toContain('ends in 3 days');
  });

  it('flags a past-due subscription as requiring operator action (manual billing)', async () => {
    await sendRenewalReminder('owner@example.com', {
      firstName: 'Owner',
      tenantName: 'Acme Eats',
      status: 'PAST_DUE',
    });

    const { subject, html } = sendMailMock.mock.calls[0][0];
    expect(subject).toBe('Acme Eats — your subscription needs attention');
    expect(html).toContain('past due');
    expect(html).toMatch(/reach your platform operator/i);
  });
});

describe('S3.3 — password-reset delegation', () => {
  it('re-exports sendPasswordResetEmail so the reset flow has one import site', async () => {
    resetMock.mockClear();
    await sendPasswordResetEmail('ada@example.com', 'reset-tok', 'https://app.example.com');
    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(resetMock.mock.calls[0][2]).toBe('https://app.example.com');
  });
});
