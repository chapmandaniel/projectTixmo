import { faker } from '@faker-js/faker';
import { OrganizationType, OrganizationStatus } from '@prisma/client';

export interface OrganizationFactoryOptions {
  name?: string;
  type?: OrganizationType;
  status?: OrganizationStatus;
}

export function createOrganizationData(options: OrganizationFactoryOptions = {}) {
  const name = options.name || faker.company.name();

  return {
    name,
    slug: faker.helpers.slugify(name).toLowerCase(),
    type: options.type || OrganizationType.PROMOTER,
    status: options.status || OrganizationStatus.ACTIVE,
    settings: {},
  };
}
