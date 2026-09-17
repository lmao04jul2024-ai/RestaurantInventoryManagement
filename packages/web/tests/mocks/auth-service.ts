import { jest } from '@jest/globals';

export const mockLogin = jest.fn();
export const mockRegister = jest.fn();
export const mockLogout = jest.fn();
export const mockChangePassword = jest.fn();

/**
 * Replaces the auth HTTP layer so the REAL `useAuth` hook can be exercised
 * (same "register in a required module" contract as mocks/next-navigation.ts).
 */
jest.mock('@/services/auth.service', () => ({
  __esModule: true,
  authService: {
    login: mockLogin,
    register: mockRegister,
    logout: mockLogout,
    changePassword: mockChangePassword,
  },
}));