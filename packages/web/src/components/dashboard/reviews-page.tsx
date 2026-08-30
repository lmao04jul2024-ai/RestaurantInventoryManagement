'use client';

import Button from '@/components/ui/button';
import Alert from '@/components/ui/alert';
import { useAllReviews, useSetReviewVisibility, useDeleteReview } from '@/hooks/use-review';
import { getApiErrorMessage } from '@/lib/api';
import type { Review } from '@/types/order';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="whitespace-nowrap text-amber-400" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      <span className="text-gray-300">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const setVisibility = useSetReviewVisibility();
  const remove = useDeleteReview();

  const toggleVisibility = async () => {
    try {
      await setVisibility.mutateAsync({ id: review.id, isVisible: !review.isVisible });
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this review permanently?')) return;
    try {
      await remove.mutateAsync(review.id);
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  const busy = setVisibility.isPending || remove.isPending;

  return (
    <li className={`rounded-card border bg-surface p-4 shadow-card ${review.isVisible ? 'border-gray-100' : 'border-amber-200 bg-amber-50/40'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Stars rating={review.rating} />
          <p className="mt-1 text-sm font-medium text-content-default">
            {review.customer?.firstName} {review.customer?.lastName}
          </p>
          <p className="text-xs text-content-muted">Order {review.order?.orderNumber}</p>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            review.isVisible ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {review.isVisible ? 'Visible' : 'Hidden'}
        </span>
      </div>
      {review.comment && (
        <blockquote className="mt-2 border-l-2 border-gray-200 pl-3 text-sm italic text-content-muted">
          {review.comment}
        </blockquote>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" disabled={busy} isLoading={setVisibility.isPending} onClick={toggleVisibility}>
          {review.isVisible ? 'Hide' : 'Show'}
        </Button>
        <Button size="sm" variant="danger" disabled={busy} isLoading={remove.isPending} onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </li>
  );
}

/** Week 11.4 — staff review moderation (list, hide/show, delete). */
export default function ReviewsPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAllReviews();
  const reviews = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        <span className="sr-only">Loading reviews…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reviews</h1>
        <p className="mt-1 text-sm text-content-muted">
          Moderate customer feedback — Week 11.
        </p>
      </div>

      {reviews.length === 0 ? (
        <Alert tone="info">No reviews yet. They appear once customers rate completed orders.</Alert>
      ) : (
        <>
          <ul className="grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </ul>
          {hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} isLoading={isFetchingNextPage}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
