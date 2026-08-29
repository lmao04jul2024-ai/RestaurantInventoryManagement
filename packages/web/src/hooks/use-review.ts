'use client';

import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { reviewService } from '@/services/review.service';
import type { ReviewLite } from '@/types/order';

// ── Queries ───────────────────────────────────────────────────────────────────

/** Customer views their own review history (paginated). */
export function useMyReviews() {
  return useInfiniteQuery({
    queryKey: ['reviews', 'me'],
    queryFn: ({ pageParam = 1 }) =>
      reviewService.listMyReviews({ page: pageParam }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
}

/** Staff views all reviews for the tenant (paginated). */
export function useAllReviews() {
  return useInfiniteQuery({
    queryKey: ['reviews', 'all'],
    queryFn: ({ pageParam = 1 }) =>
      reviewService.listReviews({ page: pageParam }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────────

const REVIEW_KEYS = ['reviews'] as const;

/** Create a review on a completed order (11.3). */
export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { orderId: string; rating: number; comment?: string | null }) =>
      reviewService.createReview(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REVIEW_KEYS });
    },
  });
}