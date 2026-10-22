'use strict';
// Runtime environment only. Never load .env or emit database/provider/error contents.
function options(args, env) {
  let apply = false;
  let preserveHashOnly = false;
  let limit = 1000;
  let organizationId;
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error('Rejected');
    seen.add(flag);
    if (flag === '--apply') apply = true;
    else if (flag === '--preserve-hash-only') preserveHashOnly = true;
    else if (flag === '--limit' && /^[0-9]{1,5}$/.test(args[i + 1] || ''))
      limit = Number(args[++i]);
    else if (
      flag === '--organization-id' &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(args[i + 1] || '')
    )
      organizationId = args[++i];
    else throw new Error('Rejected');
  }
  if (
    limit < 1 ||
    limit > 10000 ||
    (apply && env.TIXMO_ALLOW_ASSET_SHARE_REKEY !== 'true') ||
    (preserveHashOnly && env.TIXMO_ALLOW_HASH_ONLY_SHARE_PRESERVATION !== 'true')
  )
    throw new Error('Rejected');
  const explicit = env.TIXMO_ASSET_REKEY_DATABASE_URL;
  const target = new URL(explicit || '');
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !target.hostname ||
    target.pathname.length < 2 ||
    (target.searchParams.get('schema') && target.searchParams.get('schema') !== 'public') ||
    (env.DATABASE_URL && explicit !== env.DATABASE_URL)
  )
    throw new Error('Rejected');
  return { apply, preserveHashOnly, limit, organizationId, url: explicit };
}
function failureReason(error) {
  try {
    if (!(error instanceof Error)) return 'generic';
    const known = new Map([
      ['Asset share rekey configuration rejected', 'configuration'],
      ['Asset share rekey bound exceeded', 'bound'],
      ['Asset share rekey verification failed', 'verification'],
      ['Asset share rekey conflict', 'conflict'],
    ]);
    if (known.has(error.message)) return known.get(error.message);
    if (
      ['P1000', 'P1001', 'P1002', 'P1010', 'P2010', 'P2021', 'P2022', 'P2024', 'P2028'].includes(
        error.code
      )
    )
      return 'database';
  } catch {
    // Even a malformed error cannot expose arbitrary properties through diagnostics.
  }
  return 'generic';
}
function validationCounts(error, ValidationError) {
  try {
    if (typeof ValidationError !== 'function' || !(error instanceof ValidationError))
      return undefined;
    const summary = error.summary;
    const names = [
      'hashOnly',
      'missingCipher',
      'unknownFormat',
      'malformedEnvelope',
      'decryptFailed',
      'invalidHash',
      'hashMismatch',
      'validLegacy',
      'validCurrent',
    ];
    if (
      !summary ||
      Object.keys(summary).length !== names.length + 2 ||
      !['all', 'organization'].includes(summary.scope) ||
      !Number.isSafeInteger(summary.scanned) ||
      summary.scanned < 0 ||
      summary.scanned > 10000 ||
      names.some(
        (name) =>
          !Number.isSafeInteger(summary[name]) ||
          summary[name] < 0 ||
          summary[name] > summary.scanned
      ) ||
      names.reduce((sum, name) => sum + summary[name], 0) !== summary.scanned ||
      summary.validLegacy + summary.validCurrent + summary.hashOnly === summary.scanned
    )
      return undefined;
    return {
      scanned: summary.scanned,
      scope: summary.scope,
      hashOnly: summary.hashOnly,
      missingCipher: summary.missingCipher,
      unknownFormat: summary.unknownFormat,
      malformedEnvelope: summary.malformedEnvelope,
      decryptFailed: summary.decryptFailed,
      invalidHash: summary.invalidHash,
      hashMismatch: summary.hashMismatch,
      validLegacy: summary.validLegacy,
      validCurrent: summary.validCurrent,
    };
  } catch {
    return undefined;
  }
}
async function main() {
  let db;
  let ValidationError;
  let stage = 'options';
  try {
    const plan = options(process.argv.slice(2), process.env);
    stage = 'load';
    const { PrismaClient } = require('@prisma/client');
    const { rekeyAssetShares } = require('../dist/services/asset-share-rekey');
    ValidationError = require('../dist/services/asset-share-crypto').AssetShareValidationError;
    stage = 'client';
    db = new PrismaClient({ datasources: { db: { url: plan.url } }, log: [] });
    stage = 'rekey';
    const counts = await rekeyAssetShares(
      db,
      {
        key: process.env.ASSET_SHARE_ENCRYPTION_KEY,
        legacySecret:
          process.env.ASSET_SHARE_LEGACY_SECRET ||
          process.env.JWT_REFRESH_SECRET ||
          process.env.JWT_SECRET ||
          process.env.SESSION_SECRET,
      },
      plan
    );
    console.log(JSON.stringify(counts));
  } catch (error) {
    const validation = validationCounts(error, ValidationError);
    console.error(
      JSON.stringify({
        operation: 'asset-share-rekey',
        status: 'failed',
        stage,
        reason: failureReason(error),
        ...(validation ? { validation } : {}),
      })
    );
    console.error(
      'Asset share rekey failed; no completion proof. Retain legacy decryption configuration.'
    );
    process.exitCode = 1;
  } finally {
    if (db)
      await db.$disconnect().catch((error) => {
        console.error(
          JSON.stringify({
            operation: 'asset-share-rekey',
            status: 'failed',
            stage: 'disconnect',
            reason: failureReason(error),
          })
        );
        process.exitCode = 1;
      });
  }
}
if (require.main === module) void main();
module.exports = { options, failureReason, validationCounts };
