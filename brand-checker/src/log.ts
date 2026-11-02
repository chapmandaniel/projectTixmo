import { redact } from './text.js';
import type { Logger } from './types.js';

export const createLogger = (): Logger => ({
  info(message: string) {
    process.stdout.write(`${redact(message)}\n`);
  },
  alert(message: string) {
    process.stderr.write(`${redact(message)}\n`);
  },
});
