/** Jest config for @restaurant/api — node environment, unit level. Prisma is mocked where touched. */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/jest.setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js'],
  // Map the workspace package to SOURCE so ts-jest transforms it (dist may be stale)
  moduleNameMapper: {
    '^@restaurant/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  clearMocks: true,
};
