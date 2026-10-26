'use strict';

const NodeEnvironment = require('jest-environment-node').TestEnvironment;

const OUTAGE_TEST = 'redis-outage.http.test.ts';
const UNREACHABLE_REDIS_URL = 'redis://127.0.0.1:1/1';

class RedisOutageEnvironment extends NodeEnvironment {
  constructor(config, context) {
    const testPath = context && context.testPath ? String(context.testPath) : '';
    const outage = testPath.endsWith(OUTAGE_TEST);
    if (!process.env.TIXMO_ORIGINAL_REDIS_URL && process.env.REDIS_URL) {
      process.env.TIXMO_ORIGINAL_REDIS_URL = process.env.REDIS_URL;
    }
    if (outage) {
      process.env.TIXMO_REDIS_OUTAGE_TEST = '1';
      process.env.REDIS_URL = UNREACHABLE_REDIS_URL;
      if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'disposable_outage_jwt_secret_32_chars';
      if (!process.env.JWT_REFRESH_SECRET) {
        process.env.JWT_REFRESH_SECRET = 'disposable_outage_refresh_secret_32ch';
      }
      if (!process.env.SESSION_SECRET) {
        process.env.SESSION_SECRET = 'disposable_outage_session_secret_32ch';
      }
    } else {
      delete process.env.TIXMO_REDIS_OUTAGE_TEST;
      if (process.env.TIXMO_ORIGINAL_REDIS_URL) {
        process.env.REDIS_URL = process.env.TIXMO_ORIGINAL_REDIS_URL;
      }
    }
    super(config, context);
  }
}

module.exports = RedisOutageEnvironment;
