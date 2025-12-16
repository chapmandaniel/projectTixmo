import { faker } from '@faker-js/faker';
import { ScannerStatus } from '@prisma/client';
import * as crypto from 'crypto';

export interface ScannerFactoryOptions {
  organizationId: string;
  eventId?: string | null;
  createdBy: string;
  name?: string;
  status?: ScannerStatus;
}

export function createScannerData(options: ScannerFactoryOptions) {
  const apiKey = crypto.randomBytes(32).toString('hex');

  return {
    name: options.name || `Scanner ${faker.string.alphanumeric(6).toUpperCase()}`,
    deviceId: `DEV-${faker.string.alphanumeric(16).toUpperCase()}`,
    apiKey,
    organizationId: options.organizationId,
    eventId: options.eventId || null,
    createdBy: options.createdBy,
    status: options.status || ScannerStatus.ACTIVE,
  };
}
