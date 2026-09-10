import { jest } from '@jest/globals';

export const mockReplace = jest.fn();
export const mockPush = jest.fn();
export const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
  usePathname: () => '/orders/open',
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  mockBack.mockClear();
});
