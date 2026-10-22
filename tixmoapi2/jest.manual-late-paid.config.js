// Deliberately excludes tests/setup.ts (DB/bootstrap/dotenv).
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  setupFiles: [],
  setupFilesAfterEnv: [],
  testMatch: ['<rootDir>/tests/unit/payments.manual-late-paid.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};
