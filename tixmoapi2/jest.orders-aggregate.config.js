// Service-only regression: deliberately never load the integration DB setup.
module.exports = {
  rootDir: __dirname,
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: [],
  setupFilesAfterEnv: [],
  globalSetup: undefined,
  globalTeardown: undefined,
  testMatch: ['**/tests/orders-aggregate-limit.unit.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: { noUnusedLocals: false, noUnusedParameters: false },
    }],
  },
};
