import { loadConfig } from './config.js';
import { createFixtureClient } from './fixtures.js';
import { createFetchClient } from './http.js';
import { createLogger } from './log.js';
import { runChecker } from './run.js';

const main = async (): Promise<void> => {
  const logger = createLogger();
  let config;
  try {
    config = loadConfig(process.argv.slice(2), process.env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'configuration failed';
    logger.alert(`ALERT brand-checker: ${message}`);
    process.exitCode = 1;
    return;
  }
  const summary = await runChecker({
    config,
    sourceHttp: config.fixtures ? createFixtureClient() : createFetchClient(),
    apiHttp: createFetchClient(),
    logger,
  });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (!summary.ok) process.exitCode = 1;
};

main().catch(() => {
  process.stderr.write('ALERT brand-checker: run failed; recording a failed run and stopping\n');
  process.exitCode = 1;
});
