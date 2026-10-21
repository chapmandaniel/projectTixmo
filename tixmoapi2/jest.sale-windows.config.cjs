// Intentionally does not inherit jest.config.js: its setup mutates a database.
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/orders-sale-windows.unit.test.ts',
    '<rootDir>/tests/orders-aggregate-limit.unit.test.ts',
    '<rootDir>/tests/orders-tenant.unit.test.ts',
  ],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};
