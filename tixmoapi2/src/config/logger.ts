import winston from 'winston';
import { config } from './environment';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const env = config.nodeEnv;
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${String(info.timestamp)} ${String(info.level)}: ${String(info.message)}`
  )
);

const transports: winston.transport[] = [new winston.transports.Console()];

// Add file transport in production
if (config.logToFile) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }) as winston.transport,
    new winston.transports.File({ filename: 'logs/combined.log' }) as winston.transport
  );
}

export const logger = winston.createLogger({
  level: config.logLevel || level(),
  levels,
  format,
  transports,
});
