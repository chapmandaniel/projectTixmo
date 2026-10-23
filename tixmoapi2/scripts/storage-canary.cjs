'use strict';
// Fixed existing test bucket; never list or touch application objects.
const { randomUUID } = require('node:crypto');
const SCOPE = 'task602-existing-storage-canary';
const ENDPOINT = 'https://t3.storageapi.dev';
const BUCKET = 'mediabucket-ovwubxuyoklp';
const PREFIX = 'task602-canary/';
const BYTES = Buffer.from('Tixmo task602 synthetic storage canary\n');
function guard(args, env) {
  if (args.length || env.NODE_ENV !== 'production' || env.TIXMO_STORAGE_CANARY !== 'true')
    throw new Error('Rejected');
  const endpoint = env.S3_ENDPOINT || env.AWS_ENDPOINT;
  const bucket = env.S3_BUCKET_NAME || env.AWS_S3_BUCKET;
  const region = env.S3_REGION || env.AWS_REGION || 'us-east-1';
  const style = env.S3_URL_STYLE || env.AWS_S3_URL_STYLE || 'path';
  const accessKeyId = env.S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;
  if (
    endpoint !== ENDPOINT ||
    bucket !== BUCKET ||
    region !== 'auto' ||
    !['path', 'virtual'].includes(style) ||
    [accessKeyId, secretAccessKey].some(
      (value) =>
        typeof value !== 'string' ||
        !value.length ||
        value.length > 4096 ||
        /[^\x21-\x7e]/.test(value)
    )
  )
    throw new Error('Rejected');
  return { style, credentials: { accessKeyId, secretAccessKey } };
}
async function request(client, command) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      client.send(command, { abortSignal: controller.signal }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Object.assign(new Error('Rejected'), { name: 'TimeoutError' }));
        }, 5000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function readBody(body) {
  if (
    !body ||
    typeof body[Symbol.asyncIterator] !== 'function' ||
    typeof body.destroy !== 'function'
  )
    throw new Error('Rejected');
  let timer;
  try {
    return await Promise.race([
      (async () => {
        let size = 0;
        const chunks = [];
        for await (const chunk of body) {
          size += Buffer.byteLength(chunk);
          if (size > 256) throw new Error('Rejected');
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          body.destroy(Object.assign(new Error('Rejected'), { name: 'TimeoutError' }));
          reject(Object.assign(new Error('Rejected'), { name: 'TimeoutError' }));
        }, 5000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    body.destroy();
  }
}
function classifyFailure(error) {
  try {
    const status = error?.$metadata?.httpStatusCode;
    const httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
    const categories = new Map([
      ['InvalidAccessKeyId', 'authentication'],
      ['SignatureDoesNotMatch', 'authentication'],
      ['ExpiredToken', 'authentication'],
      ['InvalidToken', 'authentication'],
      ['AccessDenied', 'authorization'],
      ['PreconditionFailed', 'conflict'],
      ['ConditionalRequestConflict', 'conflict'],
      ['NoSuchKey', 'not-found'],
      ['NotFound', 'not-found'],
      ['NoSuchBucket', 'not-found'],
      ['InternalError', 'service'],
      ['ServiceUnavailable', 'service'],
      ['SlowDown', 'service'],
      ['TimeoutError', 'timeout'],
      ['AbortError', 'timeout'],
    ]);
    return { category: categories.get(error?.name) || 'generic', httpStatus };
  } catch {
    return { category: 'generic', httpStatus: null };
  }
}
async function listOwnedNamespace(client, sdk) {
  const result = await request(
    client,
    new sdk.ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, MaxKeys: 100 })
  );
  const rows = result.Contents === undefined && result.KeyCount === 0 ? [] : result.Contents;
  if (
    result.IsTruncated !== false ||
    !Array.isArray(rows) ||
    rows.length > 100 ||
    result.KeyCount !== rows.length ||
    new Set(rows.map((row) => row.Key)).size !== rows.length ||
    rows.some(
      (row) =>
        typeof row.Key !== 'string' ||
        !/^task602-canary\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.txt$/.test(
          row.Key
        )
    )
  )
    throw new Error('Rejected');
  return rows;
}
async function cleanOwnedNamespace(client, sdk, counts) {
  const rows = await listOwnedNamespace(client, sdk);
  counts.scanned = rows.length;
  // Validate EVERY candidate before deleting ANY candidate. Never trust prefix alone.
  const verified = [];
  for (const row of rows) {
    const object = await request(
      client,
      new sdk.GetObjectCommand({ Bucket: BUCKET, Key: row.Key })
    );
    const matches = (await readBody(object.Body)).equals(BYTES);
    if (
      object.ContentType !== 'text/plain' ||
      object.VersionId !== undefined ||
      !matches ||
      typeof object.ETag !== 'string' ||
      !object.ETag.length ||
      object.ETag.length > 256 ||
      /[^\x21-\x7e]/.test(object.ETag)
    )
      throw new Error('Rejected');
    verified.push({ key: row.Key, etag: object.ETag });
  }
  for (const row of verified) {
    const removed = await request(
      client,
      new sdk.DeleteObjectCommand({ Bucket: BUCKET, Key: row.key, IfMatch: row.etag })
    );
    if (removed.$metadata?.httpStatusCode !== 204) throw new Error('Rejected');
    counts.deleted++;
    let absent = false;
    try {
      await request(client, new sdk.HeadObjectCommand({ Bucket: BUCKET, Key: row.key }));
    } catch (error) {
      absent = error?.$metadata?.httpStatusCode === 404;
      if (!absent) throw error;
    }
    if (!absent) throw new Error('Rejected');
  }
  if ((await listOwnedNamespace(client, sdk)).length !== 0) throw new Error('Rejected');
  counts.empty = true;
}
async function observe(args, env, dependencies = {}) {
  if (env.TIXMO_STORAGE_CANARY !== 'true') return { scope: SCOPE, skipped: true };
  let client, sdk, style;
  const cleanupRequested = env.TIXMO_STORAGE_CANARY_CLEANUP === 'true';
  const counts = { scanned: 0, deleted: 0, empty: false };
  let failure;
  const recordFailure = (error) => {
    if (!failure) failure = { phase, ...classifyFailure(error) };
  };
  let phase = 'guard',
    putAttempted = false,
    putConfirmed = false,
    readbackMatched = false,
    deleteConfirmed = false,
    removalVerified = false;
  let owned = false,
    version;
  const key = `task602-canary/${randomUUID()}.txt`;
  try {
    const plan = guard(args, env);
    style = plan.style;
    phase = 'load';
    sdk = require('@aws-sdk/client-s3');
    client = new sdk.S3Client({
      endpoint: ENDPOINT,
      region: 'auto',
      credentials: plan.credentials,
      forcePathStyle: style === 'path',
      maxAttempts: 1,
      followRegionRedirects: false,
      requestHandler: dependencies.requestHandler || {
        connectionTimeout: 2000,
        requestTimeout: 5000,
        httpsAgent: { keepAlive: false, maxSockets: 1 },
      },
    });
    if (cleanupRequested) {
      phase = 'namespace-cleanup';
      await cleanOwnedNamespace(client, sdk, counts);
    }
    phase = 'put';
    putAttempted = true;
    const put = await request(
      client,
      new sdk.PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: BYTES,
        ContentType: 'text/plain',
        IfNoneMatch: '*',
      })
    );
    if (put.$metadata?.httpStatusCode !== 200) throw new Error('Rejected');
    putConfirmed = true;
    if (
      put.VersionId !== undefined &&
      (typeof put.VersionId !== 'string' ||
        !put.VersionId.length ||
        put.VersionId.length > 1024 ||
        /[^\x21-\x7e]/.test(put.VersionId))
    )
      throw new Error('Rejected');
    version = put.VersionId;
    owned = true;
    phase = 'get';
    const get = await request(
      client,
      new sdk.GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ...(version !== undefined ? { VersionId: version } : {}),
      })
    );
    phase = 'read';
    readbackMatched = (await readBody(get.Body)).equals(BYTES);
    if (!readbackMatched) throw new Error('Rejected');
  } catch (error) {
    recordFailure(error);
  } finally {
    if (owned) {
      try {
        phase = 'delete';
        const result = await request(
          client,
          new sdk.DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ...(version !== undefined ? { VersionId: version } : {}),
          })
        );
        deleteConfirmed = result.$metadata?.httpStatusCode === 204;
        phase = 'head';
        try {
          await request(
            client,
            new sdk.HeadObjectCommand({
              Bucket: BUCKET,
              Key: key,
              ...(version !== undefined ? { VersionId: version } : {}),
            })
          );
        } catch (error) {
          removalVerified = error?.$metadata?.httpStatusCode === 404;
          if (!removalVerified) recordFailure(error);
        }
      } catch (error) {
        recordFailure(error);
      }
    }
    if (cleanupRequested && counts.empty) {
      phase = 'namespace-verify';
      try {
        counts.empty = (await listOwnedNamespace(client, sdk)).length === 0;
        if (!counts.empty) throw new Error('Rejected');
      } catch (error) {
        counts.empty = false;
        recordFailure(error);
      }
    }
    try {
      client?.destroy();
    } catch (error) {
      removalVerified = false;
      phase = 'cleanup';
      recordFailure(error);
    }
  }
  return {
    scope: SCOPE,
    phase,
    style: style || 'unverified',
    endpointMode: 'fixed-existing-test-target',
    putAttempted,
    putConfirmed,
    readbackMatched,
    deleteConfirmed,
    removalVerified,
    failurePhase: failure?.phase || 'none',
    failureCategory: failure?.category || 'none',
    failureHttpStatus: failure?.httpStatus ?? null,
    namespaceCleanupRequested: cleanupRequested,
    namespaceScanned: counts.scanned,
    namespaceDeleted: counts.deleted,
    namespaceVerifiedEmpty: counts.empty,
    possibleOrphan: (putAttempted && !removalVerified) || (cleanupRequested && !counts.empty),
    ok:
      putConfirmed &&
      readbackMatched &&
      deleteConfirmed &&
      removalVerified &&
      (!cleanupRequested || counts.empty),
  };
}
async function main(args = process.argv.slice(2), env = process.env, dependencies = {}) {
  let reported = false;
  const timer = setTimeout(() => {
    if (!reported) {
      reported = true;
      process.stdout.write(
        JSON.stringify({ scope: SCOPE, phase: 'deadline', ok: false, possibleOrphan: true }) + '\n'
      );
    }
    process.exit(0);
  }, 35000);
  const result = await observe(args, env, dependencies);
  if (reported) return;
  reported = true;
  process.stdout.write(JSON.stringify(result) + '\n', () => {
    clearTimeout(timer);
    process.exit(0);
  });
}
if (require.main === module) void main();
module.exports = { guard, observe, main, classifyFailure };
