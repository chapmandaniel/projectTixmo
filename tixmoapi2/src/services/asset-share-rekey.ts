import { Prisma, PrismaClient } from '@prisma/client';
import {
  AssetShareKeys,
  AssetShareValidationError,
  AssetShareValidationSummary,
  classifyAssetShareToken,
  encryptAssetShareToken,
  validAssetShareKey,
  verifiedAssetShareToken,
} from './asset-share-crypto';

type RekeyOptions = { apply?: boolean; limit?: number; organizationId?: string };
type ShareRow = {
  id: string;
  organizationId: string;
  tokenHash: string;
  tokenCiphertext: string | null;
};
export async function rekeyAssetShares(
  db: PrismaClient,
  keys: AssetShareKeys,
  options: RekeyOptions = {}
) {
  const limit = options.limit ?? 1000;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 10000 ||
    !validAssetShareKey(keys.key) ||
    (options.organizationId !== undefined &&
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        options.organizationId
      ))
  ) {
    throw new Error('Asset share rekey configuration rejected');
  }
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '10000'`;
      const scope = options.organizationId
        ? Prisma.sql`WHERE organization_id = ${options.organizationId}`
        : Prisma.empty;
      const rows = await tx.$queryRaw<ShareRow[]>(Prisma.sql`
      SELECT id, organization_id AS "organizationId", token_hash AS "tokenHash", token_ciphertext AS "tokenCiphertext"
      FROM asset_library_folder_shares ${scope} ORDER BY id LIMIT ${limit + 1}`);
      if (rows.length > limit) throw new Error('Asset share rekey bound exceeded');
      // Validate the entire selected set before any write; corrupt or unknown data blocks apply.
      const prepared = rows.map((row) => ({
        row,
        validation: classifyAssetShareToken(row.tokenCiphertext, row.tokenHash, keys),
      }));
      const summary: AssetShareValidationSummary = {
        scanned: rows.length,
        scope: options.organizationId ? 'organization' : 'all',
        missingCipher: 0,
        unknownFormat: 0,
        malformedEnvelope: 0,
        decryptFailed: 0,
        invalidHash: 0,
        hashMismatch: 0,
        validLegacy: 0,
        validCurrent: 0,
      };
      for (const { validation } of prepared) summary[validation.category]++;
      if (summary.validLegacy + summary.validCurrent !== summary.scanned)
        throw new AssetShareValidationError(summary);
      let updated = 0;
      let legacy = 0;
      for (const { row, validation } of prepared) {
        if (validation.category !== 'validLegacy') continue;
        const token = validation.token;
        legacy++;
        if (!options.apply) continue;
        const ciphertext = encryptAssetShareToken(token, keys);
        // Intentionally bypass Prisma @updatedAt: only ciphertext may change.
        const count = await tx.$executeRaw`
        UPDATE asset_library_folder_shares SET token_ciphertext = ${ciphertext}
        WHERE id = ${row.id} AND organization_id = ${row.organizationId}
          AND token_hash = ${row.tokenHash} AND token_ciphertext = ${row.tokenCiphertext}`;
        if (count !== 1) throw new Error('Asset share rekey conflict');
        if (verifiedAssetShareToken(ciphertext, row.tokenHash, keys) !== token)
          throw new Error('Asset share rekey verification failed');
        updated++;
      }
      return {
        scanned: rows.length,
        legacy,
        current: rows.length - legacy,
        updated,
        audit: !options.apply,
        scope: options.organizationId ? 'organization' : 'all',
      };
    },
    { maxWait: 5000, timeout: 30000 }
  );
}
