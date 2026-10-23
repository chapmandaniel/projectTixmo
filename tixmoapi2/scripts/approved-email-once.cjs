'use strict';
// One explicitly approved operator message. Retained Redis state fences every retry.
const SCOPE = 'approved-email-task600';
const KEY = 'tixmo:operator:task-600:approved-email-attempt:v1';
const MESSAGE = Object.freeze({
  from: 'Tixmo <info@tixmo.co>',
  to: 'daniel@tixmo.co',
  subject: 'Tixmo approved delivery test',
  text: 'Daniel, this is the single approved Tixmo outbound email delivery test. No action is required.',
});
function guard(args, env) {
  if (
    args.length ||
    env.NODE_ENV !== 'production' ||
    env.TIXMO_APPROVED_EMAIL_ONCE !== 'true' ||
    env.FROM_EMAIL !== 'info@tixmo.co' ||
    env.EMAIL_FROM !== 'info@tixmo.co' ||
    env.FROM_NAME !== 'Tixmo' ||
    env.POSTMARK_MESSAGE_STREAM !== 'outbound' ||
    typeof env.POSTMARK_SERVER_TOKEN !== 'string' ||
    !env.POSTMARK_SERVER_TOKEN.length ||
    env.POSTMARK_SERVER_TOKEN.length > 512 ||
    /[^\x21-\x7e]/.test(env.POSTMARK_SERVER_TOKEN)
  )
    throw new Error('Rejected');
  if (
    typeof env.REDIS_URL !== 'string' ||
    !env.REDIS_URL.length ||
    env.REDIS_URL.length > 4096 ||
    /[\s\x00-\x1f\x7f]/.test(env.REDIS_URL)
  )
    throw new Error('Rejected');
  const redis = new URL(env.REDIS_URL);
  if (!['redis:', 'rediss:'].includes(redis.protocol) || !redis.hostname || redis.hash)
    throw new Error('Rejected');
  return env.REDIS_URL;
}
async function bounded(work, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Rejected')), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function observe(args, env, dependencies = {}) {
  if (env.TIXMO_APPROVED_EMAIL_ONCE !== 'true')
    return { scope: SCOPE, status: 'skipped', sendAttempted: false, providerAccepted: false };
  let redis;
  let phase = 'guard';
  let attemptClaimed = false;
  let sendAttempted = false;
  let providerAccepted = false;
  let redisError = false;
  let status = 'failed';
  try {
    const url = guard(args, env);
    phase = 'load';
    const createClient = dependencies.createClient || require('redis').createClient;
    redis = createClient({
      url,
      disableClientInfo: true,
      disableOfflineQueue: true,
      commandsQueueMaxLength: 2,
      socket: { connectTimeout: 3000, reconnectStrategy: false },
    });
    redis.on('error', () => {
      redisError = true;
    });
    phase = 'connect';
    await bounded(redis.connect(), 3000);
    phase = 'claim';
    const claim = await bounded(redis.set(KEY, 'claimed', { NX: true }), 3000);
    if (claim === null) status = 'duplicate-blocked';
    else {
      if (claim !== 'OK' || redisError) throw new Error('Rejected');
      attemptClaimed = true;
      phase = 'transport';
      // Production image packages only dist (no .env). Reuse the actual configured
      // Postmark transport; never call verify or print its result/error/message ID.
      const transport = dependencies.loadTransport
        ? dependencies.loadTransport()
        : require('../dist/config/email').transporter;
      phase = 'send';
      sendAttempted = true;
      await bounded(transport.sendMail({ ...MESSAGE }), 11000);
      providerAccepted = true;
      status = 'accepted';
    }
  } catch {
    status = sendAttempted ? 'uncertain' : 'failed';
  }
  if (redis && redis.isOpen) {
    try {
      await bounded(Promise.resolve(redis.disconnect()), 2000);
    } catch {
      phase = 'cleanup';
      if (!providerAccepted) status = sendAttempted ? 'uncertain' : 'failed';
    }
  }
  return {
    scope: SCOPE,
    status,
    phase,
    attemptClaimed,
    sendAttempted,
    providerAccepted,
    inboxArrivalProved: false,
  };
}
async function main(args = process.argv.slice(2), env = process.env, dependencies = {}) {
  let reported = false;
  const timer = setTimeout(() => {
    if (!reported) {
      reported = true;
      process.stdout.write(
        JSON.stringify({
          scope: SCOPE,
          status: 'uncertain',
          phase: 'deadline',
          inboxArrivalProved: false,
        }) + '\n'
      );
    }
    process.exit(0); // Operator helper failure must not restart the app or repeat mail.
  }, 25000);
  const result = await observe(args, env, dependencies);
  if (reported) return;
  reported = true;
  process.stdout.write(JSON.stringify(result) + '\n', () => {
    clearTimeout(timer);
    process.exit(0);
  });
}
if (require.main === module) void main();
module.exports = { guard, observe, main };
