// Explicit dedicated job only; normal Jest discovery never selects *.soak.ts.
module.exports = {
  ...require('./jest.config.js'),
  roots: ['<rootDir>/tests/qualification'],
  testMatch: ['**/orders-http.soak.ts'],
  collectCoverage: false,
};
