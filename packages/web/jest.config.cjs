/**
 * Jest config for @restaurant/web (Next.js App Router).
 * - jsdom env pairs with jest ^29 (bundled env removed in jest 28+).
 * - Standalone tsconfig.jest.json overrides Next's jsx:"preserve" which
 *   ts-jest cannot execute (needs react-jsx runtime emission).
 */
module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json', isolatedModules: true }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@restaurant/shared$': '<rootDir>/../shared/src/index.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.spec.{ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  clearMocks: true,
};
