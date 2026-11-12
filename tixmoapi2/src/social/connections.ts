import { randomUUID } from 'crypto';
import prisma from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { readSocialConfig } from './config';
import { DEFAULT_KEYWORD_VALUES, DEFAULT_THRESHOLD_VALUES, READ_SCOPES } from './defaults';
import {
  graphErrorCode,
  parseAccountsList,
  sandboxGraphGet,
  type GraphFetcher,
} from './graph-client';
import { emitSocialLog, type SocialLogger } from './log';
import { disconnectConnection, sealSandboxToken } from './token-policy';
import { loadKeyRing, SocialTokenError } from './token-crypto';

const requireAdmin = (role?: string | null) => {
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw ApiError.forbidden('Org admins connect and disconnect sandbox Pages');
  }
};

const requireOrg = (organizationId?: string | null) => {
  if (!organizationId) throw ApiError.forbidden('Organization required');
  return organizationId;
};

export const ensureOrgSettings = async (organizationId: string) => {
  const existing = await prisma.socialOrgSettings.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return prisma.socialOrgSettings.create({
    data: {
      id: randomUUID(),
      organizationId,
      thresholds: DEFAULT_THRESHOLD_VALUES,
      keywords: DEFAULT_KEYWORD_VALUES,
      highEmailEnabled: true,
      digestEnabled: false,
      digestHourLocal: 9,
    },
  });
};

export const listConnections = async (organizationId: string) => {
  const rows = await prisma.socialConnection.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform === 'FACEBOOK_PAGE' ? 'Facebook' : 'Instagram',
    platformLabel:
      row.platform === 'FACEBOOK_PAGE' ? 'Facebook Page (sandbox)' : 'Instagram (sandbox)',
    name: row.displayName,
    handle: row.handle,
    status: row.status,
    lastSync: row.lastSyncAt?.toISOString() || null,
    attention: row.lastErrorCode || '',
    // Never expose ciphertext, keyId, or token fields.
  }));
};

export const discoverSandboxPages = async (input: {
  organizationId: string;
  role?: string | null;
  accessToken: string;
  fetcher?: GraphFetcher;
  logger?: SocialLogger;
}) => {
  requireAdmin(input.role);
  const organizationId = requireOrg(input.organizationId);
  const config = readSocialConfig();
  if (!config.enabled) throw ApiError.notFound('Social Command Center is not enabled');
  if (!config.ready || !config.sandboxBaseUrl) {
    throw ApiError.badRequest('Social Command Center is not ready');
  }
  // Refuse before any network call.
  sealSandboxToken({
    token: input.accessToken,
    organizationId,
    connectionId: 'discover',
    tokenKind: 'sandbox',
    graphBaseUrl: config.sandboxBaseUrl,
  });
  const result = await sandboxGraphGet({
    baseUrl: config.sandboxBaseUrl,
    path: '/me/accounts',
    accessToken: input.accessToken,
    query: { fields: 'id,name,instagram_business_account{id,username}' },
    teamAccessKey: process.env.SOCIAL_SANDBOX_TEAM_ACCESS_KEY,
    fetcher: input.fetcher,
    logger: input.logger,
    organizationId,
  });
  if (result.status >= 400) {
    throw ApiError.badRequest(
      `Sandbox Graph refused accounts (${graphErrorCode(result.json) || result.status})`
    );
  }
  return parseAccountsList(result.json);
};

export const connectSandboxPage = async (input: {
  organizationId: string;
  userId: string;
  role?: string | null;
  accessToken: string;
  pageId: string;
  eventIds?: string[];
  fetcher?: GraphFetcher;
  logger?: SocialLogger;
}) => {
  requireAdmin(input.role);
  const organizationId = requireOrg(input.organizationId);
  const config = readSocialConfig();
  if (!config.enabled) throw ApiError.notFound('Social Command Center is not enabled');
  if (!config.ready || !config.sandboxBaseUrl) {
    throw ApiError.badRequest('Social Command Center is not ready');
  }

  const pages = await discoverSandboxPages({
    organizationId,
    role: input.role,
    accessToken: input.accessToken,
    fetcher: input.fetcher,
    logger: input.logger,
  });
  const page = pages.find((item) => item.id === input.pageId);
  if (!page) throw ApiError.badRequest('Sandbox Page not found for this token');

  await ensureOrgSettings(organizationId);
  const ring = loadKeyRing();
  const pageConnectionId = randomUUID();
  const sealed = sealSandboxToken({
    token: input.accessToken,
    organizationId,
    connectionId: pageConnectionId,
    tokenKind: 'sandbox',
    graphBaseUrl: config.sandboxBaseUrl,
    ring,
  });

  const pageRow = await prisma.socialConnection.create({
    data: {
      id: pageConnectionId,
      organizationId,
      platform: 'FACEBOOK_PAGE',
      externalAccountId: page.id,
      displayName: page.name,
      handle: null,
      status: 'CONNECTED',
      tokenKind: 'sandbox',
      keyId: sealed.keyId,
      tokenCiphertext: sealed.ciphertext,
      refreshCiphertext: null,
      lookupHmac: sealed.lookupHmac,
      graphBaseUrl: sealed.graphBaseUrl,
      scopes: [...READ_SCOPES],
      createdById: input.userId,
    },
  });

  let igRow = null;
  if (page.linkedInstagramId) {
    const igConnectionId = randomUUID();
    const igSealed = sealSandboxToken({
      token: input.accessToken,
      organizationId,
      connectionId: igConnectionId,
      tokenKind: 'sandbox',
      graphBaseUrl: config.sandboxBaseUrl,
      ring,
    });
    igRow = await prisma.socialConnection.create({
      data: {
        id: igConnectionId,
        organizationId,
        platform: 'INSTAGRAM',
        externalAccountId: page.linkedInstagramId,
        displayName: page.linkedInstagramUsername || page.linkedInstagramId,
        handle: page.linkedInstagramUsername || null,
        status: 'CONNECTED',
        tokenKind: 'sandbox',
        keyId: igSealed.keyId,
        tokenCiphertext: igSealed.ciphertext,
        refreshCiphertext: null,
        lookupHmac: igSealed.lookupHmac,
        graphBaseUrl: igSealed.graphBaseUrl,
        scopes: [...READ_SCOPES],
        linkedConnectionId: pageRow.id,
        createdById: input.userId,
      },
    });
    await prisma.socialConnection.update({
      where: { id: pageRow.id },
      data: { linkedConnectionId: igRow.id },
    });
  }

  if (input.eventIds?.length) {
    // Mapping rows are per-post; eventIds at connect time are recorded as holds of preference only via settings note.
    // Event date mapping happens at sync for posts.
  }

  emitSocialLog(input.logger, 'info', 'connection.connect', {
    organizationId,
    connectionId: pageRow.id,
  });

  return {
    accounts: await listConnections(organizationId),
    connectedIds: [pageRow.id, igRow?.id].filter(Boolean),
  };
};

export const disconnectSandboxAccount = async (input: {
  organizationId: string;
  role?: string | null;
  connectionId: string;
  logger?: SocialLogger;
}) => {
  requireAdmin(input.role);
  const organizationId = requireOrg(input.organizationId);
  const row = await prisma.socialConnection.findFirst({
    where: { id: input.connectionId, organizationId },
  });
  if (!row) throw ApiError.notFound('Connection not found');

  const cleared = disconnectConnection({
    id: row.id,
    organizationId: row.organizationId,
    status: row.status,
    tokenKind: row.tokenKind,
    tokenCiphertext: row.tokenCiphertext,
    refreshCiphertext: row.refreshCiphertext,
    lookupHmac: row.lookupHmac,
    graphBaseUrl: row.graphBaseUrl,
  });

  // Overwrite then clear ciphertext.
  if (row.tokenCiphertext) {
    try {
      const ring = loadKeyRing();
      const overwrite = sealSandboxToken({
        token: `sbx_revoked_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        organizationId,
        connectionId: row.id,
        tokenKind: 'sandbox',
        graphBaseUrl: row.graphBaseUrl,
        ring,
      });
      await prisma.socialConnection.update({
        where: { id: row.id },
        data: {
          tokenCiphertext: overwrite.ciphertext,
          refreshCiphertext: null,
          lookupHmac: overwrite.lookupHmac,
        },
      });
    } catch (error) {
      if (!(error instanceof SocialTokenError)) throw error;
    }
  }

  await prisma.socialConnection.update({
    where: { id: row.id },
    data: {
      status: cleared.status,
      tokenCiphertext: null,
      refreshCiphertext: null,
      lookupHmac: null,
      keyId: null,
      lastErrorCode: null,
      lastErrorAt: null,
    },
  });

  emitSocialLog(input.logger, 'info', 'connection.disconnect', {
    organizationId,
    connectionId: row.id,
  });

  return { ok: true, accounts: await listConnections(organizationId) };
};
