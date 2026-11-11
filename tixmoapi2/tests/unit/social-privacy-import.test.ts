import fs from 'fs';
import path from 'path';

const SOCIAL_ROOT = path.join(__dirname, '../../src/social');
const SOCIAL_API_ROOT = path.join(__dirname, '../../src/api/social');

const FORBIDDEN_IMPORT =
  /from\s+['"][^'"]*(orders?|tickets?|payments?|scanner|refund|invoice-counts|vendors\/|buyer)[^'"]*['"]/i;
const FORBIDDEN_PRISMA_CLIENT = /from\s+['"]@prisma\/client['"]/;
const FORBIDDEN_BUYER_WORDS = /\b(customer|buyer|ticket holder)\b/i;

const walk = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!/\.(ts|js)$/.test(entry.name)) return [];
    return [full];
  });
};

describe('social privacy import guard', () => {
  const files = [...walk(SOCIAL_ROOT), ...walk(SOCIAL_API_ROOT)];

  it('does not import order, ticket, payment, scanner, refund, or buyer modules', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      if (FORBIDDEN_IMPORT.test(source)) offenders.push(path.relative(process.cwd(), file));
    }
    expect(offenders).toEqual([]);
  });

  it('keeps Prisma access behind config/prisma, not a direct @prisma/client import in social API', () => {
    const offenders: string[] = [];
    for (const file of walk(SOCIAL_API_ROOT)) {
      const source = fs.readFileSync(file, 'utf8');
      if (FORBIDDEN_PRISMA_CLIENT.test(source)) offenders.push(path.relative(process.cwd(), file));
    }
    expect(offenders).toEqual([]);
  });

  it('does not label commenters as customer, buyer, or ticket holder in social sources', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      // Allow the forbid-list itself and explicit denylist documentation.
      if (file.endsWith('social-privacy-import.test.ts')) continue;
      if (file.endsWith('alert-email.ts')) continue;
      if (
        FORBIDDEN_BUYER_WORDS.test(source) &&
        !/never "customer"|never customer|not.*buyer/i.test(source)
      ) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
