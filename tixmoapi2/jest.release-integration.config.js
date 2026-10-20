// Mock-only lane; deliberately never loads integration DB bootstrap.
module.exports = {
  rootDir: __dirname, preset: 'ts-jest', testEnvironment: 'node',
  moduleNameMapper: require('./jest.config').moduleNameMapper,
  setupFiles: [], setupFilesAfterEnv: [],
  testMatch: ['**/tests/integration/payments_retry.test.ts', '**/tests/orders-aggregate-limit.unit.test.ts', '**/tests/orders-tenant.unit.test.ts', '**/tests/orders-recovery.unit.test.ts', '**/tests/unit/release-integration.test.ts', '**/tests/unit/release-order-scope.test.ts', '**/tests/unit/payments.webhook-signature.test.ts', '**/tests/unit/payments.webhook-recovery.test.ts', '**/tests/unit/payments.prepare.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { noUnusedLocals: false, noUnusedParameters: false } }] },
};
