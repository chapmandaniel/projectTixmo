const path = require('node:path');
const root = path.resolve(__dirname, '../../../../tixmoapi2');
module.exports = { ...require(path.join(root, 'jest.config.js')), rootDir: root, setupFilesAfterEnv: [path.join(root, 'tests/setup.ts'), path.join(__dirname, 'diagnostics.setup.cjs')] };
