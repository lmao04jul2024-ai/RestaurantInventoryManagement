'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/user.service';
import { useAuthStore } from '@/store/auth.store';

/** Week 11.6 — current profile (kept warm for the /account form). */
export function useMyProfile() {
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: userService.getMyProfile,
    staleTime: 60_000,
  });
}

/** PATCH /users/me — mirrors the saved profile into the auth store in place. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  return useMutation({
    mutationFn: (payload: { firstName?: string; lastName?: string; phone?: string | null }) =>
      userService.updateMyProfile(payload),
    onSuccess: (user) => {
      qc.setQueryData(['users', 'me'], user);
      updateUser({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? null,
      });
    },
  });
}
