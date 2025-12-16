import { faker } from '@faker-js/faker';
import { EventStatus } from '@prisma/client';

export interface EventFactoryOptions {
  organizationId: string;
  venueId: string;
  name?: string;
  category?: string;
  status?: EventStatus;
  daysFromNow?: number;
}

export function createEventData(options: EventFactoryOptions) {
  const categories = ['CONCERT', 'SPORTS', 'COMEDY', 'THEATER', 'CONFERENCE', 'FESTIVAL'];
  const category = options.category || faker.helpers.arrayElement(categories);

  const daysFromNow = options.daysFromNow || faker.number.int({ min: 7, max: 90 });
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + daysFromNow);
  startDate.setHours(19, 0, 0, 0); // 7 PM

  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 3); // 3 hours later

  const salesStartDate = new Date();
  salesStartDate.setDate(salesStartDate.getDate() - 30); // Sales started 30 days ago

  const salesEndDate = new Date(startDate);
  salesEndDate.setHours(salesEndDate.getHours() - 2); // Sales end 2 hours before event

  const eventNames = {
    CONCERT: () =>
      `${faker.music.songName()} ${faker.helpers.arrayElement(['Tour', 'Live', 'Concert'])}`,
    SPORTS: () => `${faker.company.name()} vs ${faker.company.name()}`,
    COMEDY: () =>
      `${faker.person.fullName()} ${faker.helpers.arrayElement(['Comedy Night', 'Stand-Up Special'])}`,
    THEATER: () =>
      `${faker.music.songName()} ${faker.helpers.arrayElement(['The Musical', 'The Play'])}`,
    CONFERENCE: () =>
      `${faker.company.buzzNoun()} ${faker.helpers.arrayElement(['Summit', 'Conference', 'Expo'])}`,
    FESTIVAL: () =>
      `${faker.color.human()} ${faker.helpers.arrayElement(['Music', 'Food', 'Arts'])} Festival`,
  };

  const name = options.name || eventNames[category as keyof typeof eventNames]();

  return {
    organizationId: options.organizationId,
    venueId: options.venueId,
    name,
    slug:
      faker.helpers.slugify(name).toLowerCase() + '-' + faker.string.alphanumeric(6).toLowerCase(),
    description: faker.lorem.paragraphs(2),
    category,
    tags: [
      faker.music.genre(),
      faker.helpers.arrayElement(['live', 'outdoor', 'family-friendly', 'vip-available']),
    ],
    startDatetime: startDate,
    endDatetime: endDate,
    timezone: 'America/New_York',
    status: options.status || EventStatus.ON_SALE,
    salesStart: salesStartDate,
    salesEnd: salesEndDate,
    capacity: faker.number.int({ min: 500, max: 10000 }),
    images: [],
  };
}
