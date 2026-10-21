// Pure rendering only: never load integration setup, database or providers.
module.exports = {
  rootDir: __dirname,
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: [],
  setupFilesAfterEnv: [],
  testMatch: ['**/tests/unit/receipt-template.test.ts'],
};
