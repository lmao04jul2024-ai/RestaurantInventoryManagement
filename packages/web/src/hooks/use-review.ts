'use client';

import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { reviewService } from '@/services/review.service';

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

/** Staff: toggle review visibility (11.4). */
export function useSetReviewVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      reviewService.setVisibility(id, isVisible),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REVIEW_KEYS });
    },
  });
}

/** Staff: delete a review (11.4). */
export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reviewService.deleteReview(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REVIEW_KEYS });
    },
  });
}
