'use strict';
// Runtime-only cutover observation. Public GETs increment normal share view counters.
// No app/config loaders, mail, provider mutations or direct database writes.
const HOST = 'backend-api-production-cbfa.up.railway.app';
const SCOPE = 'retained-encrypted-asset-links-test-target';
function guard(args, env) {
  if (args.length || env.NODE_ENV !== 'production' || env.TIXMO_ASSET_LINK_CHECK !== 'true')
    throw new Error('Rejected');
  const url = env.TIXMO_ASSET_REKEY_DATABASE_URL;
  if (typeof url !== 'string' || typeof env.ASSET_SHARE_ENCRYPTION_KEY !== 'string')
    throw new Error('Rejected');
  const target = new URL(url);
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !target.hostname ||
    target.pathname.length < 2 ||
    url !== env.DATABASE_URL ||
    target.searchParams.getAll('schema').length > 1 ||
    target.searchParams.getAll('schema').some((schema) => schema !== 'public') ||
    !/^[a-f0-9]{64}$/.test(env.ASSET_SHARE_ENCRYPTION_KEY || '')
  )
    throw new Error('Rejected');
  return { url, key: env.ASSET_SHARE_ENCRYPTION_KEY };
}
function get(token) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(new Error('Rejected'));
      else resolve(result);
    };
    const request = require('node:https').request(
      {
        hostname: HOST,
        port: 443,
        method: 'GET',
        path: `/api/v1/assets/shares/${encodeURIComponent(token)}`,
        headers: { Accept: 'application/json' },
      },
      (response) => {
        let bytes = 0;
        const chunks = [];
        response.on('data', (chunk) => {
          bytes += Buffer.byteLength(chunk);
          if (bytes > 1024 * 1024) {
            finish(true);
            request.destroy();
          } else chunks.push(Buffer.from(chunk));
        });
        response.on('error', () => finish(true));
        response.on('aborted', () => finish(true));
        response.on('end', () => {
          try {
            finish(false, {
              status: response.statusCode,
              body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
            });
          } catch {
            finish(true);
          }
        });
      }
    );
    request.on('error', () => finish(true));
    timer = setTimeout(() => {
      finish(true);
      request.destroy();
    }, 5000);
    request.end();
  });
}
async function observe(args, env, dependencies = {}) {
  let db;
  let phase = 'guard';
  try {
    const plan = guard(args, env);
    phase = 'load';
    const crypto = dependencies.crypto || require('../dist/services/asset-share-crypto');
    const PrismaClient = dependencies.PrismaClient || require('@prisma/client').PrismaClient;
    db = new PrismaClient({ datasources: { db: { url: plan.url } }, log: [] });
    phase = 'inventory';
    const rows = await db.assetLibraryFolderShare.findMany({
      select: {
        id: true,
        tokenHash: true,
        tokenCiphertext: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: { id: 'asc' },
      take: 1001,
    });
    if (!Array.isArray(rows) || rows.length > 1000) throw new Error('Rejected');
    let hashOnlyUnverified = 0;
    const encrypted = [];
    for (const row of rows) {
      if (
        typeof row.id !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(row.id) ||
        !(row.expiresAt instanceof Date) ||
        !Number.isFinite(row.expiresAt.getTime()) ||
        (row.revokedAt !== null &&
          (!(row.revokedAt instanceof Date) || !Number.isFinite(row.revokedAt.getTime())))
      )
        throw new Error('Rejected');
      if (row.tokenCiphertext === null && /^[a-f0-9]{64}$/.test(row.tokenHash)) {
        hashOnlyUnverified++;
        continue;
      }
      const validation = crypto.classifyAssetShareToken(row.tokenCiphertext, row.tokenHash, {
        key: plan.key,
      });
      if (validation.category !== 'validCurrent') throw new Error('Rejected');
      encrypted.push({ ...row, token: validation.token });
    }
    phase = 'links';
    let activeAccepted = 0;
    let inactiveRejected = 0;
    for (const row of encrypted) {
      // A link expiring during the bounded request may validly return 404.
      const startedAt = Date.now();
      const response = await (dependencies.get || get)(row.token);
      const inactive = row.revokedAt !== null || row.expiresAt.getTime() <= startedAt;
      const rejectedByShareRoute =
        response.status === 404 &&
        response.body?.success === false &&
        response.body?.message === 'Invalid or expired folder share link';
      if (inactive) {
        if (!rejectedByShareRoute) throw new Error('Rejected');
        inactiveRejected++;
      } else if (
        response.status === 200 &&
        response.body?.share?.id === row.id &&
        Array.isArray(response.body.folders) &&
        Array.isArray(response.body.assets)
      )
        activeAccepted++;
      else if (rejectedByShareRoute && row.expiresAt.getTime() <= Date.now()) inactiveRejected++;
      else throw new Error('Rejected');
    }
    phase = 'disconnect';
    await db.$disconnect();
    db = undefined;
    return {
      ok: true,
      scope: SCOPE,
      scanned: rows.length,
      encryptedVerified: encrypted.length,
      hashOnlyUnverified,
      activeAccepted,
      inactiveRejected,
      legacy: 0,
      directDatabaseWrites: false,
      publicGetMayIncrementViews: true,
      hashOnlyBearerAccessProved: false,
    };
  } catch {
    return { ok: false, scope: SCOPE, phase, completionProved: false };
  } finally {
    if (db) await db.$disconnect().catch(() => {});
  }
}
async function main(args = process.argv.slice(2), env = process.env) {
  const deadline = setTimeout(() => {
    console.log(
      JSON.stringify({ ok: false, scope: SCOPE, phase: 'deadline', completionProved: false })
    );
    process.exit(1);
  }, 30000);
  try {
    const result = await observe(args, env);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
  }
}
if (require.main === module) void main();
module.exports = { guard, observe, get };
