import { faker } from '@faker-js/faker';

export interface VenueFactoryOptions {
  organizationId: string;
  name?: string;
  capacity?: number;
  timezone?: string;
}

export function createVenueData(options: VenueFactoryOptions) {
  const cities = [
    { city: 'New York', state: 'NY', zip: '10001', timezone: 'America/New_York' },
    { city: 'Los Angeles', state: 'CA', zip: '90001', timezone: 'America/Los_Angeles' },
    { city: 'Chicago', state: 'IL', zip: '60601', timezone: 'America/Chicago' },
    { city: 'Austin', state: 'TX', zip: '78701', timezone: 'America/Chicago' },
    { city: 'Nashville', state: 'TN', zip: '37201', timezone: 'America/Chicago' },
    { city: 'Portland', state: 'OR', zip: '97201', timezone: 'America/Los_Angeles' },
  ];

  const location = faker.helpers.arrayElement(cities);

  return {
    organizationId: options.organizationId,
    name:
      options.name ||
      `${faker.company.name()} ${faker.helpers.arrayElement(['Arena', 'Theater', 'Hall', 'Stadium', 'Center'])}`,
    address: {
      street: faker.location.streetAddress(),
      city: location.city,
      state: location.state,
      country: 'USA',
      postalCode: location.zip,
    },
    capacity: options.capacity || faker.number.int({ min: 500, max: 15000 }),
    timezone: options.timezone || location.timezone,
    metadata: {},
  };
}
