const path = require('node:path');
const rootDir = path.resolve(__dirname, '../../../../tixmoapi2');
module.exports = {
  ...require(path.join(rootDir, 'jest.config.js')),
  rootDir,
  // These suites mock Prisma and Redis. The shared integration setup performs
  // prisma db push, so it must not execute in this explicitly no-DB unit lane.
  setupFilesAfterEnv: [],
  cacheDirectory: path.join(__dirname, 'jest-cache'),
};
