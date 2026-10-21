// Explicit mock-only lane: never inherits tests/setup.ts or DB bootstrap.
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  setupFiles: [], setupFilesAfterEnv: [],
  testMatch: ['<rootDir>/tests/unit/waiting-room*.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { noUnusedLocals: false, noUnusedParameters: false } }] },
};
