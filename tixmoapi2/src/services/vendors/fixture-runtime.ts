import { readFileSync } from 'fs';
import path from 'path';
import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { parseDiscoveryEvent } from './discovery';
import { shiftDaysToClear } from './fixture-clock';
import { VendorEventRecord } from './types';

export const FIXTURE_RUNTIME_ID = 'showpass';

const fixtureRoot = () => path.resolve(__dirname, '../../../fixtures/showpass');

const readJson = (relative: string): unknown =>
  JSON.parse(readFileSync(path.join(fixtureRoot(), relative), 'utf8'));

type Catalog = { revisions: Record<string, string[]> };

const catalog = (): Catalog => readJson('catalog.json') as Catalog;

const splitKeys = (value: string | undefined): string[] =>
  (value || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

const catalogEvents = (): VendorEventRecord[] => {
  const files = new Set(Object.values(catalog().revisions).flat());
  return [...files].flatMap((file) => {
    const event = parseDiscoveryEvent(readJson(file));
    return event ? [event] : [];
  });
};

export const computedFixtureShiftDays = (now = new Date()): number =>
  shiftDaysToClear(catalogEvents(), now);

const envShiftDays = (): number | null => {
  const raw = process.env.SHOWPASS_FIXTURE_SHIFT_DAYS?.trim();
  if (raw === undefined || raw === '') return null;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
};

type RuntimeRow = { revision: string; revokedKeys: string[]; shiftDays: number };

const readRow = async (): Promise<RuntimeRow | null> => {
  try {
    return await prisma.vendorFixtureRuntime.findUnique({ where: { id: FIXTURE_RUNTIME_ID } });
  } catch {
    return null;
  }
};

const rememberShift = async (shiftDays: number): Promise<void> => {
  try {
    await prisma.vendorFixtureRuntime.upsert({
      where: { id: FIXTURE_RUNTIME_ID },
      create: { id: FIXTURE_RUNTIME_ID, revision: 'baseline', revokedKeys: [], shiftDays },
      update: { shiftDays },
    });
  } catch {
    // The table is absent until migrate. Callers still use the computed shift.
  }
};

export type FixtureControl = {
  revision: string;
  revokedKeys: string[];
  shiftDays: number;
};

/**
 * Env revision and shift win when set, so tests stay pinned.
 * Stored revision wins when SHOWPASS_FIXTURE_REVISION is unset.
 * Revoked keys are the union of the env boot list and the stored list.
 */
export const resolveFixtureControl = async (): Promise<FixtureControl> => {
  const row = await readRow();
  const pinnedShift = envShiftDays();
  let shiftDays = pinnedShift ?? row?.shiftDays;
  if (shiftDays === undefined || shiftDays === null) {
    shiftDays = computedFixtureShiftDays();
    await rememberShift(shiftDays);
  }
  const revision = process.env.SHOWPASS_FIXTURE_REVISION?.trim() || row?.revision || 'baseline';
  const revokedKeys = [
    ...new Set([
      ...splitKeys(process.env.SHOWPASS_FIXTURE_REVOKED_KEYS),
      ...(row?.revokedKeys ?? []),
    ]),
  ];
  return { revision, revokedKeys, shiftDays };
};

export const updateFixtureRuntime = async (input: {
  revision?: string;
  revokedKeys?: string[];
}): Promise<FixtureControl> => {
  if (process.env.SHOWPASS_ADAPTER !== 'fixture') {
    const error = new ApiError(404, 'Showpass fixture control is disabled');
    error.code = 'FIXTURE_CONTROL_DISABLED';
    throw error;
  }
  if (input.revision === undefined && input.revokedKeys === undefined) {
    throw ApiError.badRequest('revision or revokedKeys is required');
  }
  const known = catalog().revisions;
  if (input.revision !== undefined && !known[input.revision]) {
    throw ApiError.badRequest('Unknown Showpass fixture revision');
  }
  const current = await resolveFixtureControl();
  const revision = input.revision ?? current.revision;
  const revokedKeys = input.revokedKeys ?? current.revokedKeys;
  const saved = await prisma.vendorFixtureRuntime.upsert({
    where: { id: FIXTURE_RUNTIME_ID },
    create: {
      id: FIXTURE_RUNTIME_ID,
      revision,
      revokedKeys,
      shiftDays: current.shiftDays,
    },
    update: {
      ...(input.revision !== undefined ? { revision } : {}),
      ...(input.revokedKeys !== undefined ? { revokedKeys } : {}),
    },
  });
  return {
    revision: saved.revision,
    revokedKeys: saved.revokedKeys,
    shiftDays: saved.shiftDays,
  };
};
