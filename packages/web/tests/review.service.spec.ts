jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import api from '@/lib/api';
import { reviewService } from '@/services/review.service';

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;
const apiDelete = api.delete as jest.Mock;

describe('reviewService — Week 11 endpoint contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a review via POST /reviews', async () => {
    apiPost.mockResolvedValue({
      data: { data: { id: 'rev-1', rating: 5, comment: 'Great!' } },
    });

    const review = await reviewService.createReview({
      orderId: 'order-1', rating: 5, comment: 'Great!',
    });

    expect(apiPost).toHaveBeenCalledWith('/reviews', {
      orderId: 'order-1', rating: 5, comment: 'Great!',
    });
    expect(review.rating).toBe(5);
  });

  it('lists customer reviews via GET /reviews/me', async () => {
    apiGet.mockResolvedValue({
      data: {
        data: [{ id: 'rev-1', rating: 4 }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    const result = await reviewService.listMyReviews({ page: 1 });

    expect(apiGet).toHaveBeenCalledWith('/reviews/me', { params: { page: 1 } });
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('lists all reviews via GET /reviews (staff)', async () => {
    apiGet.mockResolvedValue({
      data: {
        data: [{ id: 'rev-1', rating: 4 }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    const result = await reviewService.listReviews({ rating: 5 });

    expect(apiGet).toHaveBeenCalledWith('/reviews', { params: { rating: 5 } });
    expect(result.data).toHaveLength(1);
  });

  it('sets visibility via PATCH /reviews/:id/visibility', async () => {
    apiPatch.mockResolvedValue({
      data: { data: { id: 'rev-1', isVisible: false } },
    });

    const review = await reviewService.setVisibility('rev-1', false);

    expect(apiPatch).toHaveBeenCalledWith('/reviews/rev-1/visibility', { isVisible: false });
    expect(review.isVisible).toBe(false);
  });

  it('deletes a review via DELETE /reviews/:id', async () => {
    apiDelete.mockResolvedValue({ status: 204 });

    await reviewService.deleteReview('rev-1');

    expect(apiDelete).toHaveBeenCalledWith('/reviews/rev-1');
  });
});