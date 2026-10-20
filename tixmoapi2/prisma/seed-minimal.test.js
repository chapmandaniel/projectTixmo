const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seedMinimal } = require('./seed-minimal');

function fixture(existing = null) {
    const writes = [];
    const logs = [];
    const hashes = [];
    return {
        writes, logs, hashes,
        prisma: {
            user: {
                findUnique: async () => existing,
                upsert: async (args) => { writes.push(['user', args]); return args.create; },
            },
            organization: {
                upsert: async (args) => { writes.push(['org', args]); return { id: 'org-1' }; },
            },
        },
        hash: async (...args) => { hashes.push(args); return 'synthetic-hash'; },
        logger: { log: (...args) => logs.push(args.join(' ')) },
        env: {},
    };
}

test('missing, empty and whitespace-only credentials fail before any writes', async () => {
    for (const value of [undefined, '', '   ']) {
        const f = fixture();
        f.env.SEED_ADMIN_PASSWORD = value;
        await assert.rejects(seedMinimal(f), /SEED_ADMIN_PASSWORD is required/);
        assert.deepEqual(f.writes, []);
        assert.deepEqual(f.hashes, []);
    }
});

test('existing account is preserved without hashing or organization writes', async () => {
    const existing = { id: 'existing', passwordHash: 'unchanged', role: 'CUSTOMER', organizationId: 'other-org' };
    const snapshot = { ...existing };
    for (const env of [{}, { SEED_ADMIN_PASSWORD: 'synthetic-explicit-input' }]) {
        const f = fixture(existing);
        f.env = env;
        assert.equal(await seedMinimal(f), existing);
        assert.deepEqual(existing, snapshot);
        assert.deepEqual(f.writes, []);
        assert.deepEqual(f.hashes, []);
    }
});

test('new account uses only explicit credential and never logs credential or hash', async () => {
    const f = fixture();
    f.env.SEED_ADMIN_PASSWORD = 'synthetic-explicit-input';
    const result = await seedMinimal(f);
    assert.deepEqual(f.hashes, [['synthetic-explicit-input', 10]]);
    assert.equal(result.passwordHash, 'synthetic-hash');
    assert.equal(result.role, 'ADMIN');
    assert.equal(result.organizationId, 'org-1');
    assert.deepEqual(f.writes.map(([kind]) => kind), ['org', 'user']);
    assert.deepEqual(f.writes[1][1].update, {});
    assert.ok(!f.logs.join(' ').includes('synthetic-explicit-input'));
    assert.ok(!f.logs.join(' ').includes('synthetic-hash'));
});

test('account appearing concurrently is not reset by upsert', async () => {
    const f = fixture();
    const concurrent = { role: 'CUSTOMER', organizationId: 'other-org', passwordHash: 'original' };
    f.env.SEED_ADMIN_PASSWORD = 'synthetic-explicit-input';
    f.prisma.user.upsert = async ({ update }) => {
        assert.deepEqual(update, {});
        return { ...concurrent, ...update };
    };
    assert.deepEqual(await seedMinimal(f), concurrent);
});

test('hash failure occurs before any writes and is not logged', async () => {
    const f = fixture();
    f.env.SEED_ADMIN_PASSWORD = 'synthetic-explicit-input';
    f.hash = async () => { throw new Error('synthetic-explicit-input'); };
    await assert.rejects(seedMinimal(f));
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.logs, []);
});
