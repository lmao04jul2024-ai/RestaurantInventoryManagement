/** Jest config for @restaurant/shared — pure TS utilities, node environment. */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { target: 'es2020', module: 'commonjs', esModuleInterop: true } }],
  },
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js'],
};
