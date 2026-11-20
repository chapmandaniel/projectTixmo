'use strict';

// Jest setupFiles run in the worker before any test file.
//
// A developer tixmoapi2/.env (usually copied from .env.example) leaks into
// Jest when a test flips NODE_ENV away from "test" and reloads
// src/config/environment.ts, which then calls dotenv.config(). .env.example
// sets AUTH_RATE_LIMIT_MAX=20, a localhost CORS_ORIGIN, SENTRY_RELEASE=local,
// and other dev defaults. Those 429 auth tests and break CORS /health
// assertions that expect the unset defaults.
//
// For every key named in .env or .env.example that the Jest command
// environment did not already provide, pin an empty string so dotenv cannot
// fill it (dotenv does not overwrite existing keys). Rate-limit, CORS, and
// /health readers all treat empty the same as unset. Tests that assign a
// value later still win. jest.mock('dotenv') in setup.ts covers
// jest.resetModules(), which would otherwise reload the real dotenv.
//
// Production and `npm run dev` never load this file, so their defaults
// and validation are unchanged.

const fs = require('fs');
const path = require('path');

function collectDocEnvKeys() {
  const keys = new Set();
  const dir = path.resolve(__dirname, '..');
  for (const file of [path.join(dir, '.env'), path.join(dir, '.env.example')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) keys.add(trimmed.slice(0, eq));
    }
  }
  return keys;
}

for (const key of collectDocEnvKeys()) {
  if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
    process.env[key] = '';
  }
}

const dotenv = require('dotenv');
dotenv.config = function config() {
  return { parsed: {} };
};
