import { jest } from '@jest/globals';

export const mockReplace = jest.fn();
export const mockPush = jest.fn();
export const mockBack = jest.fn();
/** Query-string stand-in — defaults to "no params" in every test. */
export const mockSearchParams = { get: jest.fn() };
jest.mock('next/navigation', () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
  usePathname: () => '/orders/open',
  useSearchParams: () => mockSearchParams,
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  mockBack.mockClear();
  mockSearchParams.get.mockReset();
  mockSearchParams.get.mockReturnValue(null);
});
