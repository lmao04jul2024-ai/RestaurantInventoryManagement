'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Week 11.2/11.6 — customer account preferences, persisted to localStorage
 * (`rms-prefs`). Separate from the cart/auth stores so preferences survive
 * cart clears and re-logins.
 */
interface PrefsState {
  /** Master gate for the order-status toast stream (11.2). */
  statusNotifications: boolean;
  toggleStatusNotifications: () => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      statusNotifications: true,
      toggleStatusNotifications: () =>
        set((s) => ({ statusNotifications: !s.statusNotifications })),
    }),
    { name: 'rms-prefs', storage: createJSONStorage(() => localStorage) },
  ),
);
