const path = require('node:path');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('ts-node').register({
  transpileOnly: true,
  project: path.join(__dirname, '..', 'tsconfig.json'),
});
const { assertDevelopmentTarget } = require('../prisma/utils/development-client');

try {
  const target = assertDevelopmentTarget(process.env, 'TIXMO_ALLOW_LOCAL_MIGRATIONS');
  const result = spawnSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
    {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: target },
      stdio: 'inherit',
      shell: false,
    }
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
