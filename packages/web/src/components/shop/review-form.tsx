'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import { useCreateReview } from '@/hooks/use-review';
import type { ReviewLite } from '@/types/order';
import { getApiErrorMessage, getApiErrorCode } from '@/lib/api';

interface ReviewFormProps {
  orderId: string;
  existing?: ReviewLite | null;
}

const STARS = [1, 2, 3, 4, 5] as const;

/** Week 11.3 — "Rate your experience" on a COMPLETED order. */
export default function ReviewForm({ orderId, existing }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submittedRating, setSubmittedRating] = useState(existing?.rating ?? 0);

  const createReview = useCreateReview();
  const isLoading = createReview.isPending;
  const alreadyReviewed = !!existing;

  const handleSubmit = async () => {
    if (rating < 1) return;
    try {
      await createReview.mutateAsync({ orderId, rating, comment: comment || null });
      setSubmittedRating(rating);
      setRating(0);
      setHover(0);
      setComment('');
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === 'REVIEW_EXISTS') {
        window.alert('You have already reviewed this order.');
      } else {
        window.alert(getApiErrorMessage(err));
      }
    }
  };

  if (alreadyReviewed) {
    return (
      <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
        <span role="img" aria-label="checked" className="mr-1">
          ✓
        </span>
        You rated this order <strong>{submittedRating}/5</strong>.
        {existing?.comment && (
          <blockquote className="mt-2 italic">“{existing.comment}”</blockquote>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="mt-6 space-y-3 rounded-lg border border-gray-200 p-4"
    >
      <p className="text-sm font-medium text-gray-700">Rate your experience</p>

      <div className="flex gap-1" role="radiogroup">
        {STARS.map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === rating}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            disabled={isLoading}
            className="text-2xl focus:outline-none"
          >
            <span className={star <= (hover || rating) ? 'text-amber-400' : 'text-gray-300'}>
              ★
            </span>
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What did you think? (optional)"
        maxLength={1000}
        rows={3}
        disabled={isLoading}
        className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      <Button
        type="submit"
        size="sm"
        disabled={isLoading || rating < 1}
        isLoading={isLoading}
      >
        Submit review
      </Button>
    </form>
  );
}