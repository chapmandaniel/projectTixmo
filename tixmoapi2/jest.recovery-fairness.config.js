// Setup-free: no DB/bootstrap/dotenv. All runtime transports are mocked.
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  setupFiles: [],
  setupFilesAfterEnv: [],
  testMatch: [
    '<rootDir>/tests/unit/payments.recovery-fairness.test.ts',
    '<rootDir>/tests/unit/payments.manual-late-paid.test.ts',
  ],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};
