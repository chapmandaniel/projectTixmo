/* eslint-disable no-console */

export const seedLogger = {
  info: (message: string, ...args: unknown[]) => {
    console.log('ℹ', message, ...args);
  },
  success: (message: string, ...args: unknown[]) => {
    console.log('✓', message, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.log('✗', message, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.log('⚠', message, ...args);
  },
};
