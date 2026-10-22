// Actual SQL/service boundaries; transport is refused, no provider access.
jest.mock('../../src/services/upload.service', () => ({
  uploadService: new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('Asset rekey forbids transport');
      },
    }
  ),
}));
import { PrismaClient } from '@prisma/client';
import { createCipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import prisma from '../../src/config/prisma';
import { config } from '../../src/config/environment';
import { assetLibraryService } from '../../src/api/assets/service';
import { rekeyAssetShares } from '../../src/services/asset-share-rekey';
import {
  encryptAssetShareToken,
  AssetShareValidationError,
  hashAssetShareToken,
  verifiedAssetShareToken,
} from '../../src/services/asset-share-crypto';
const second = new PrismaClient({ log: [] });
const key = '12'.repeat(32);
const legacySecret = 'synthetic-asset-legacy-secret';
const keys = { key, legacySecret };
const ids = {
  org: randomUUID(),
  foreignOrg: randomUUID(),
  user: randomUUID(),
  foreignUser: randomUUID(),
  folder: randomUUID(),
  extraFolder: randomUUID(),
  foreignFolder: randomUUID(),
};
const shares = Array.from({ length: 4 }, () => randomUUID()).sort();
const tokens = shares.map(() => randomBytes(32).toString('base64url'));
const diagnosticShares = Array.from({ length: 6 }, () => randomUUID());
const diagnosticTokens = diagnosticShares.map(() => randomBytes(32).toString('base64url'));
const hashOnlyShares: string[] = Array.from({ length: 4 }, () => randomUUID());
const hashOnlyTokens = hashOnlyShares.map(() => randomBytes(32).toString('base64url'));
const foreignShare = randomUUID();
const foreignToken = randomBytes(32).toString('base64url');
const mismatchedToken = randomBytes(32).toString('base64url');
const live = new Set<Promise<unknown>>();
let unsafe = false;
const restorers: Array<{ restore: () => void }> = [];
const safe = () => {
  if (unsafe) throw new Error('Asset rekey context preserved for job teardown');
};
const rekey = (...args: Parameters<typeof rekeyAssetShares>) => {
  safe();
  return rekeyAssetShares(...args);
};
function track<T>(work: () => Promise<T>): Promise<T> {
  safe();
  const promise = Promise.resolve().then(() => {
    safe();
    return work();
  });
  live.add(promise);
  void promise.then(
    () => live.delete(promise),
    () => live.delete(promise)
  );
  return promise;
}
async function bounded<T>(work: Promise<T>, ms = 20000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          unsafe = true;
          reject(new Error('Asset rekey join deadline'));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
const owned = (name: string, work: () => Promise<void>) =>
  it(name, () => bounded(track(work)), 25000);
const legacy = (token: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    createHash('sha256').update(legacySecret).digest(),
    iv
  );
  const encrypted = Buffer.concat([cipher.update(token), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
};
const snapshot = () =>
  prisma.assetLibraryFolderShare.findMany({
    where: { id: { in: [...shares, ...diagnosticShares, ...hashOnlyShares, foreignShare] } },
    include: { folders: { orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  });
const withoutCipher = (rows: Awaited<ReturnType<typeof snapshot>>) =>
  rows.map(({ tokenCiphertext: _cipher, ...row }) => row);
async function resetOwned() {
  for (let i = 0; i < shares.length; i++) {
    safe();
    await prisma.assetLibraryFolderShare.update({
      where: { id: shares[i] },
      data: {
        tokenHash: hashAssetShareToken(tokens[i]),
        tokenCiphertext: i === 2 ? encryptAssetShareToken(tokens[i], keys) : legacy(tokens[i]),
      },
    });
  }
}
beforeAll(
  () =>
    bounded(
      track(async () => {
        restorers.push(
          jest.replaceProperty(config, 'assetShareEncryptionKey', key),
          jest.replaceProperty(config, 'assetShareLegacySecret', legacySecret)
        );
        for (const foreign of [false, true]) {
          safe();
          await prisma.organization.create({
            data: {
              id: foreign ? ids.foreignOrg : ids.org,
              name: 'Synthetic asset rekey',
              slug: randomUUID(),
              type: 'PROMOTER',
              status: 'ACTIVE',
            },
          });
          safe();
          await prisma.user.create({
            data: {
              id: foreign ? ids.foreignUser : ids.user,
              organizationId: foreign ? ids.foreignOrg : ids.org,
              email: `${randomUUID()}@synthetic.test`,
              passwordHash: 'not-for-login',
              firstName: 'Synthetic',
              lastName: 'Rekey',
              role: 'OWNER',
            },
          });
        }
        for (const [id, foreign] of [
          [ids.folder, false],
          [ids.extraFolder, false],
          [ids.foreignFolder, true],
        ] as const) {
          safe();
          await prisma.assetLibraryFolder.create({
            data: {
              id,
              organizationId: foreign ? ids.foreignOrg : ids.org,
              createdById: foreign ? ids.foreignUser : ids.user,
              name: 'Synthetic folder',
            },
          });
        }
        for (let i = 0; i < shares.length; i++) {
          safe();
          await prisma.assetLibraryFolderShare.create({
            data: {
              id: shares[i],
              organizationId: ids.org,
              folderId: ids.folder,
              createdById: ids.user,
              tokenHash: hashAssetShareToken(tokens[i]),
              tokenCiphertext: legacy(tokens[i]),
              recipientLabel: 'Synthetic recipient',
              expiresAt: new Date(Date.now() + (i === 1 ? -1 : 1) * 86400000),
              revokedAt: i === 3 ? new Date() : null,
              viewCount: 7,
              lastViewedAt: new Date('2026-01-01T00:00:00Z'),
              folders: { create: [{ folderId: ids.folder }, { folderId: ids.extraFolder }] },
            },
          });
        }
        safe();
        await prisma.assetLibraryFolderShare.create({
          data: {
            id: foreignShare,
            organizationId: ids.foreignOrg,
            folderId: ids.foreignFolder,
            createdById: ids.foreignUser,
            tokenHash: hashAssetShareToken(foreignToken),
            tokenCiphertext: legacy(foreignToken),
            expiresAt: new Date(Date.now() + 86400000),
          },
        });
        await resetOwned();
      })
    ),
  25000
);
afterAll(async () => {
  await bounded(Promise.allSettled([...live]));
  safe();
  await bounded(
    track(async () => {
      safe();
      await prisma.assetLibraryFolderShareFolder.deleteMany({
        where: {
          shareId: { in: [...shares, ...diagnosticShares, ...hashOnlyShares, foreignShare] },
        },
      });
      safe();
      await prisma.assetLibraryFolderShare.deleteMany({
        where: { id: { in: [...shares, ...diagnosticShares, ...hashOnlyShares, foreignShare] } },
      });
      safe();
      await prisma.assetLibraryFolder.deleteMany({
        where: { id: { in: [ids.folder, ids.extraFolder, ids.foreignFolder] } },
      });
      safe();
      await prisma.user.deleteMany({ where: { id: { in: [ids.user, ids.foreignUser] } } });
      safe();
      await prisma.organization.deleteMany({ where: { id: { in: [ids.org, ids.foreignOrg] } } });
    })
  );
  safe();
  await bounded(Promise.all([prisma.$disconnect(), second.$disconnect()]));
  safe();
  restorers.forEach((item) => item.restore());
}, 45000);
owned(
  'audit is read-only; mixed-version apply preserves every metadata field, scope and actual staff/public URL',
  async () => {
    const before = await snapshot();
    const links = await assetLibraryService.listFolderShares(
      ids.user,
      ids.folder,
      'https://synthetic.invalid'
    );
    expect(
      links.shares.find((row: { id: string; shareUrl?: string }) => row.id === shares[0])?.shareUrl
    ).toBe(`https://synthetic.invalid/assets/shared/${tokens[0]}`);
    await expect(
      assetLibraryService.listFolderShares(ids.foreignUser, ids.folder, 'https://synthetic.invalid')
    ).rejects.toMatchObject({ statusCode: 404 });
    expect((await rekey(prisma, keys, { organizationId: ids.org })).legacy).toBe(3);
    expect(await snapshot()).toEqual(before);
    await expect(
      rekey(prisma, keys, { apply: true, organizationId: ids.org })
    ).resolves.toMatchObject({ scanned: 4, updated: 3, current: 1 });
    const after = await snapshot();
    expect(withoutCipher(after)).toEqual(withoutCipher(before));
    expect(after.find((row) => row.id === foreignShare)).toEqual(
      before.find((row) => row.id === foreignShare)
    );
    expect(
      await assetLibraryService.listFolderShares(ids.user, ids.folder, 'https://synthetic.invalid')
    ).toEqual(links);
    for (let i = 0; i < shares.length; i++) {
      const row = after.find((item) => item.id === shares[i])!;
      expect(row.tokenCiphertext).toMatch(/^v2:/);
      expect(
        verifiedAssetShareToken(row.tokenCiphertext, row.tokenHash, {
          key,
          legacySecret: 'rotated-auth',
        })
      ).toBe(tokens[i]);
    }
    await expect(
      rekey(prisma, { key }, { apply: true, organizationId: ids.org })
    ).resolves.toMatchObject({ updated: 0, legacy: 0 });
    expect(await snapshot()).toEqual(after);
  }
);
owned(
  'bounds, malformed key, unknown/corrupt ciphertext and hash mismatch abort without any rewrite',
  async () => {
    await resetOwned();
    for (const bad of [
      'v9:a:b:c',
      legacy(tokens[0]).slice(0, -1),
      encryptAssetShareToken(tokens[1], keys),
      null,
    ]) {
      safe();
      await prisma.assetLibraryFolderShare.update({
        where: { id: shares[0] },
        data: { tokenCiphertext: bad },
      });
      const before = await snapshot();
      await expect(rekey(prisma, keys, { apply: true, organizationId: ids.org })).rejects.toThrow(
        'verification failed'
      );
      expect(await snapshot()).toEqual(before);
    }
    await resetOwned();
    const before = await snapshot();
    await expect(
      rekey(prisma, { key: 'bad', legacySecret }, { apply: true, organizationId: ids.org })
    ).rejects.toThrow('configuration rejected');
    await expect(
      rekey(prisma, keys, { apply: true, limit: 3, organizationId: ids.org })
    ).rejects.toThrow('bound exceeded');
    expect(await snapshot()).toEqual(before);
  }
);
owned('concurrent real SQL rekeys never duplicate effects or change scope/metadata', async () => {
  await resetOwned();
  const before = await snapshot();
  const results = await Promise.allSettled([
    rekey(prisma, keys, { apply: true, organizationId: ids.org }),
    rekey(second, keys, { apply: true, organizationId: ids.org }),
  ]);
  expect(results.filter((item) => item.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
  for (const result of results)
    if (result.status === 'rejected')
      expect(result.reason).toMatchObject({ message: 'Asset share rekey conflict' });
  const after = await snapshot();
  expect(withoutCipher(after)).toEqual(withoutCipher(before));
  for (const row of after.filter((item) => item.organizationId === ids.org))
    expect(row.tokenCiphertext).toMatch(/^v2:/);
  expect(after.find((row) => row.id === foreignShare)).toEqual(
    before.find((row) => row.id === foreignShare)
  );
});
owned(
  'stale cipher selection cannot overwrite a newer SQL result and rolls back prior rewrites',
  async () => {
    await resetOwned();
    const transaction = prisma.$transaction.bind(prisma);
    let newerSnapshot: Awaited<ReturnType<typeof snapshot>> | undefined;
    let observed = false;
    // Observation wrapper preserves the actual SQL query/results. A separate real
    // connection commits a newer ciphertext after selection and before the old CAS.
    const observation = jest.spyOn(prisma, '$transaction').mockImplementation(((
      callback: any,
      options: any
    ) =>
      transaction((tx) => {
        safe();
        const query = tx.$queryRaw.bind(tx);
        const wrapped = new Proxy(tx, {
          get(target, property) {
            if (property === '$queryRaw')
              return async (...args: any[]) => {
                safe();
                const rows = await (query as any)(...args);
                if (!observed) {
                  observed = true;
                  safe();
                  await second.$executeRaw`UPDATE asset_library_folder_shares SET token_ciphertext = ${encryptAssetShareToken(tokens[3], keys)} WHERE id = ${shares[3]}`;
                  newerSnapshot = await snapshot();
                }
                return rows;
              };
            const value = Reflect.get(target, property);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        return callback(wrapped);
      }, options)) as any);
    try {
      await expect(rekey(prisma, keys, { apply: true, organizationId: ids.org })).rejects.toThrow(
        'rekey conflict'
      );
    } finally {
      // Preserve observation/configuration if a timed-out transaction may still be live.
      if (!unsafe) observation.mockRestore();
    }
    expect(observed).toBe(true);
    expect(newerSnapshot).toBeDefined();
    expect(await snapshot()).toEqual(newerSnapshot);
  }
);

owned(
  'explicit NULL policy preserves unverified bearers and only rewrites verified legacy rows',
  async () => {
    await resetOwned();
    const auth = [] as Array<{ restore: () => void }>;
    try {
      for (let i = 0; i < 3; i++) {
        safe();
        await prisma.assetLibraryFolderShare.create({
          data: {
            id: hashOnlyShares[i],
            organizationId: ids.org,
            folderId: ids.folder,
            createdById: ids.user,
            tokenHash: hashAssetShareToken(hashOnlyTokens[i]),
            tokenCiphertext: null,
            recipientLabel: 'Synthetic hash-only',
            expiresAt: new Date(Date.now() + (i === 1 ? -86400000 : 86400000)),
            revokedAt: i === 2 ? new Date() : null,
            folders: { create: [ids.folder, ids.extraFolder].map((folderId) => ({ folderId })) },
          },
        });
      }
      safe();
      const publicBefore = await assetLibraryService.getSharedFolder(hashOnlyTokens[0]);
      expect(publicBefore.rootFolders.map((row: { id: string }) => row.id).sort()).toEqual(
        [ids.folder, ids.extraFolder].sort()
      );
      expect(publicBefore.folders.some((row) => row.id === ids.foreignFolder)).toBe(false);
      const before = await snapshot();
      await expect(rekey(prisma, keys, { organizationId: ids.org })).rejects.toBeInstanceOf(
        AssetShareValidationError
      );
      expect(await snapshot()).toEqual(before);
      const options = { organizationId: ids.org, preserveHashOnly: true };
      expect(await rekey(prisma, keys, options)).toMatchObject({
        scanned: 7,
        legacy: 3,
        current: 1,
        hashOnly: 3,
        updated: 0,
        hashOnlyPolicyEnabled: true,
        hashOnlyCryptographicallyVerified: false,
        hashOnlyReconstructable: false,
      });
      expect(await snapshot()).toEqual(before);
      await expect(rekey(prisma, keys, { ...options, apply: true, limit: 6 })).rejects.toThrow(
        'bound exceeded'
      );
      expect(await snapshot()).toEqual(before);
      expect(await rekey(prisma, keys, { ...options, apply: true })).toMatchObject({
        updated: 3,
        hashOnly: 3,
      });
      const after = await snapshot();
      expect(withoutCipher(after)).toEqual(withoutCipher(before));
      expect(after.filter((row) => hashOnlyShares.includes(row.id))).toEqual(
        before.filter((row) => hashOnlyShares.includes(row.id))
      );
      expect(after.find((row) => row.id === foreignShare)).toEqual(
        before.find((row) => row.id === foreignShare)
      );
      expect(await rekey(prisma, keys, options)).toMatchObject({
        legacy: 0,
        current: 4,
        hashOnly: 3,
        updated: 0,
      });
      expect(await snapshot()).toEqual(after);
      safe();
      auth.push(
        jest.replaceProperty(config, 'jwtSecret', 'synthetic-new-auth'),
        jest.replaceProperty(config, 'jwtRefreshSecret', 'synthetic-new-refresh'),
        jest.replaceProperty(config, 'sessionSecret', 'synthetic-new-session')
      );
      const publicAfter = await assetLibraryService.getSharedFolder(hashOnlyTokens[0]);
      expect(publicAfter).toEqual(publicBefore);
      const viewed = await snapshot();
      const oldRow = after.find((row) => row.id === hashOnlyShares[0])!;
      const newRow = viewed.find((row) => row.id === hashOnlyShares[0])!;
      expect(newRow).toEqual({
        ...oldRow,
        viewCount: oldRow.viewCount + 1,
        lastViewedAt: newRow.lastViewedAt,
        updatedAt: newRow.updatedAt,
      });
      expect(newRow.lastViewedAt).toBeInstanceOf(Date);
      for (const token of [
        hashOnlyTokens[1],
        hashOnlyTokens[2],
        randomBytes(32).toString('base64url'),
      ]) {
        safe();
        await expect(assetLibraryService.getSharedFolder(token)).rejects.toMatchObject({
          statusCode: 404,
        });
      }
      safe();
      await expect(
        assetLibraryService.listFolderShares(
          ids.foreignUser,
          ids.folder,
          'https://synthetic.invalid'
        )
      ).rejects.toMatchObject({ statusCode: 404 });
      safe();
      const links = await assetLibraryService.listFolderShares(
        ids.user,
        ids.folder,
        'https://synthetic.invalid'
      );
      expect(
        links.shares.find((row: { id: string; shareUrl?: string }) => row.id === hashOnlyShares[0])
          ?.shareUrl
      ).toBeUndefined();
      expect(await snapshot()).toEqual(viewed);
      for (const [cipher, hash] of [
        ['', hashAssetShareToken(hashOnlyTokens[0])],
        [null, 'invalid'],
        ['v2:a:b:c', hashAssetShareToken(hashOnlyTokens[0])],
        [encryptAssetShareToken(hashOnlyTokens[0], keys), hashAssetShareToken(mismatchedToken)],
      ] as const) {
        safe();
        await prisma.assetLibraryFolderShare.update({
          where: { id: hashOnlyShares[0] },
          data: { tokenCiphertext: cipher, tokenHash: hash },
        });
        const invalid = await snapshot();
        for (const apply of [false, true]) {
          await expect(rekey(prisma, keys, { ...options, apply })).rejects.toBeInstanceOf(
            AssetShareValidationError
          );
          expect(await snapshot()).toEqual(invalid);
        }
      }
    } finally {
      if (!unsafe) {
        auth.forEach((item) => item.restore());
        safe();
        await prisma.assetLibraryFolderShareFolder.deleteMany({
          where: { shareId: { in: hashOnlyShares } },
        });
        safe();
        await prisma.assetLibraryFolderShare.deleteMany({ where: { id: { in: hashOnlyShares } } });
      }
    }
  }
);

owned(
  'mixed invalid audit reports only aggregate categories and apply aborts before every write',
  async () => {
    await resetOwned();
    const ciphers = [
      null,
      'v9:a:b:c',
      'v2:a:b:c',
      encryptAssetShareToken(diagnosticTokens[3], { key: '34'.repeat(32) }),
      encryptAssetShareToken(diagnosticTokens[4], keys),
      encryptAssetShareToken(diagnosticTokens[5], keys),
    ];
    for (let i = 0; i < diagnosticShares.length; i++) {
      safe();
      await prisma.assetLibraryFolderShare.create({
        data: {
          id: diagnosticShares[i],
          organizationId: ids.org,
          folderId: ids.folder,
          createdById: ids.user,
          tokenHash:
            i === 4
              ? `invalid-${diagnosticShares[i]}`
              : hashAssetShareToken(
                  i === 5 ? randomBytes(32).toString('base64url') : diagnosticTokens[i]
                ),
          tokenCiphertext: ciphers[i],
          recipientLabel: 'Synthetic diagnostic fixture',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
    }
    const before = await snapshot();
    const { validationCounts } = require('../../prisma/rekey-asset-shares');
    for (const apply of [false, true]) {
      let failure: unknown;
      try {
        await rekey(prisma, keys, { apply, organizationId: ids.org });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(AssetShareValidationError);
      expect(validationCounts(failure, AssetShareValidationError)).toEqual({
        scanned: 10,
        scope: 'organization',
        hashOnly: 0,
        missingCipher: 1,
        unknownFormat: 1,
        malformedEnvelope: 1,
        decryptFailed: 1,
        invalidHash: 1,
        hashMismatch: 1,
        validLegacy: 3,
        validCurrent: 1,
      });
      expect(await snapshot()).toEqual(before);
    }
  }
);
