/**
 * Jest config for @restaurant/mobile.
 *
 * The scoped @react-native/jest-preset package has no 0.7x releases, but
 * react-native@0.73 bundles an equivalent preset at its package root — we
 * reference it by absolute-ish relative path. Tests stay on pure logic /
 * token mapping (no native module graphs) so no extra mocks are required.
 */
module.exports = {
  // Directory form: Jest appends /jest-preset.js itself. The scoped
  // @react-native/jest-preset has no 0.7x release on npm, but react-native
  // ships an equivalent at its package root.
  preset: '<rootDir>/../../node_modules/react-native',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@restaurant/shared$': '<rootDir>/../shared/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      // isolatedModules stays OFF so the type-only `TextStyle` import elides
      // instead of requiring a react-native runtime graph in pure-logic tests.
      { tsconfig: { target: 'es2020', module: 'commonjs', esModuleInterop: true } },
    ],
  },
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
};
