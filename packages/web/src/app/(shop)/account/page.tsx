'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import { useMyProfile, useUpdateProfile } from '@/hooks/use-user';
import { useAuthStore } from '@/store/auth.store';
import { usePrefsStore } from '@/store/prefs.store';
import { getApiErrorMessage } from '@/lib/api';

/**
 * Week 11.6 — customer profile & preferences.
 * Profile: GET/PATCH /users/me (names + phone, mirrored into the auth store).
 * Preferences: local persisted prefs store (status-notification toggle).
 */
export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const statusNotifications = usePrefsStore((s) => s.statusNotifications);
  const toggleStatusNotifications = usePrefsStore((s) => s.toggleStatusNotifications);
  const { data: profile } = useMyProfile();
  const updateProfile = useUpdateProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const source = profile ?? user ?? null;

  useEffect(() => {
    if (!source) return;
    setFirstName(source.firstName);
    setLastName(source.lastName);
    setPhone(source.phone ?? '');
  }, [source]);

  const dirty =
    !!source &&
    (firstName !== source.firstName ||
      lastName !== source.lastName ||
      phone !== (source.phone ?? ''));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await updateProfile.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() === '' ? null : phone.trim(),
      });
      setFeedback({ tone: 'success', text: 'Profile saved.' });
    } catch (err) {
      setFeedback({ tone: 'error', text: getApiErrorMessage(err) });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-content-default">My account</h1>
        <p className="mt-1 text-sm text-content-muted">Profile and preferences — Week 11.</p>
      </div>

      {/* Profile */}
      <Card>
        <h2 className="text-lg font-semibold text-content-default">Profile</h2>
        <form onSubmit={save} className="mt-4 space-y-4">
          {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-content-default">
                First name
              </label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-content-default">
                Last name
              </label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-content-default">
              Phone <span className="font-normal text-content-muted">(optional)</span>
            </label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              maxLength={20}
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-content-default">
              Email <span className="font-normal text-content-muted">(cannot be changed)</span>
            </label>
            <Input id="email" value={source?.email ?? ''} disabled readOnly />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={updateProfile.isPending} disabled={!dirty || updateProfile.isPending}>
              Save changes
            </Button>
            {dirty && !updateProfile.isPending && (
              <span className="text-xs text-content-muted">Unsaved changes</span>
            )}
          </div>
        </form>
      </Card>

      {/* Preferences */}
      <Card>
        <h2 className="text-lg font-semibold text-content-default">Preferences</h2>
        <label className="mt-4 flex items-start gap-3" htmlFor="status-notifications">
          <input
            id="status-notifications"
            type="checkbox"
            checked={statusNotifications}
            onChange={toggleStatusNotifications}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm">
            <span className="font-medium text-content-default">Order status notifications</span>
            <span className="block text-content-muted">
              Toast updates while your orders move through the kitchen.
            </span>
          </span>
        </label>
      </Card>

      <p className="text-sm">
        <Link href="/orders" className="font-medium text-primary-600 hover:underline">
          ← Back to my orders
        </Link>
      </p>
    </div>
  );
}
