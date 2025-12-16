import { faker } from '@faker-js/faker';
import { TicketTypeStatus } from '@prisma/client';

export interface TicketTypeFactoryOptions {
  eventId: string;
  name?: string;
  price?: number;
  quantity?: number;
  status?: TicketTypeStatus;
}

export function createTicketTypeData(options: TicketTypeFactoryOptions) {
  const quantity = options.quantity || faker.number.int({ min: 50, max: 500 });
  const soldPercentage = faker.number.float({ min: 0, max: 0.8 });
  const quantitySold = Math.floor(quantity * soldPercentage);
  const quantityAvailable = quantity - quantitySold;

  return {
    eventId: options.eventId,
    name: options.name || 'General Admission',
    description: faker.lorem.sentence(),
    price: options.price || faker.number.float({ min: 15, max: 150, fractionDigits: 2 }),
    quantityTotal: quantity,
    quantityAvailable,
    quantitySold,
    quantityHeld: 0,
    maxPerOrder: faker.number.int({ min: 4, max: 10 }),
    status: options.status || TicketTypeStatus.ACTIVE,
  };
}
