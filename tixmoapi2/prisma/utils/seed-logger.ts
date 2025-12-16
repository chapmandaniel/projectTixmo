/* eslint-disable no-console */
import chalk from 'chalk';

export const seedLogger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(chalk.blue('ℹ'), message, ...args);
  },
  success: (message: string, ...args: unknown[]) => {
    console.log(chalk.green('✓'), message, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.log(chalk.red('✗'), message, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.log(chalk.yellow('⚠'), message, ...args);
  },
};
