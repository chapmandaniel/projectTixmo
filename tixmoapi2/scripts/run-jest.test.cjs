'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DEFAULT_HEAP_MB, ensureLocalJestHeap } = require('./run-jest.cjs');

test('leaves CI heap unchanged', () => {
  const env = { CI: 'true', NODE_OPTIONS: '--enable-source-maps' };
  assert.deepEqual(ensureLocalJestHeap(env), env);
  assert.deepEqual(ensureLocalJestHeap({ CI: '1' }), { CI: '1' });
});

test('adds 8192 MiB when NODE_OPTIONS is unset', () => {
  assert.equal(
    ensureLocalJestHeap({}).NODE_OPTIONS,
    `--max-old-space-size=${DEFAULT_HEAP_MB}`
  );
});

test('appends to existing NODE_OPTIONS and preserves other flags', () => {
  assert.equal(
    ensureLocalJestHeap({ NODE_OPTIONS: '--enable-source-maps' }).NODE_OPTIONS,
    `--enable-source-maps --max-old-space-size=${DEFAULT_HEAP_MB}`
  );
});

test('raises a smaller existing ceiling and keeps a larger one', () => {
  assert.equal(
    ensureLocalJestHeap({ NODE_OPTIONS: '--max-old-space-size=4096 --enable-source-maps' })
      .NODE_OPTIONS,
    `--max-old-space-size=${DEFAULT_HEAP_MB} --enable-source-maps`
  );
  assert.equal(
    ensureLocalJestHeap({ NODE_OPTIONS: '--max-old-space-size=16384' }).NODE_OPTIONS,
    '--max-old-space-size=16384'
  );
});
