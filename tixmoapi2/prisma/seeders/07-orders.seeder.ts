import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
  User,
  Event,
  TicketType,
  PromoCode,
} from '@prisma/client';
import { faker } from '@faker-js/faker';
import { seedLogger } from '../utils/seed-logger';
import { createOrderData } from '../factories/order.factory';

export async function seedOrders(
  prisma: PrismaClient,
  users: User[],
  events: Event[],
  ticketTypes: TicketType[],
  promoCodes: PromoCode[]
) {
  seedLogger.info('Seeding orders...');

  const orders = [];
  const orderCount = 40;

  // Get customer users only
  const customers = users.filter((u) => u.role === 'CUSTOMER');

  // Status distribution
  const statusDistribution = [
    ...Array(28).fill({ status: OrderStatus.PAID, paymentStatus: PaymentStatus.SUCCEEDED }), // 70%
    ...Array(6).fill({ status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING }), // 15%
    ...Array(4).fill({ status: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.FAILED }), // 10%
    ...Array(2).fill({ status: OrderStatus.REFUNDED, paymentStatus: PaymentStatus.SUCCEEDED }), // 5%
  ];

  for (let i = 0; i < orderCount; i++) {
    const customer = customers[i % customers.length];
    const event = events[i % events.length];
    const { status, paymentStatus } = statusDistribution[i % statusDistribution.length];

    // 30% chance of using a promo code
    const promoCode =
      Math.random() > 0.7 ? promoCodes[Math.floor(Math.random() * promoCodes.length)] : null;

    const order = await prisma.order.create({
      data: createOrderData({
        userId: customer.id,
        eventId: event.id,
        status,
        paymentStatus,
        promoCodeId: promoCode?.id,
      }),
    });

    orders.push(order);

    // Create tickets for paid orders
    if (status === OrderStatus.PAID) {
      const eventTicketTypes = ticketTypes.filter((tt) => tt.eventId === event.id);
      if (eventTicketTypes.length > 0) {
        // Create 1-4 tickets per order
        const ticketCount = Math.floor(Math.random() * 4) + 1;

        for (let j = 0; j < ticketCount; j++) {
          const ticketType = eventTicketTypes[Math.floor(Math.random() * eventTicketTypes.length)];

          await prisma.ticket.create({
            data: {
              orderId: order.id,
              eventId: event.id,
              ticketTypeId: ticketType.id,
              userId: customer.id,
              barcode: `TIX-${faker.string.alphanumeric(12).toUpperCase()}`,
              qrCodeUrl: `https://example.com/qr/${faker.string.alphanumeric(16)}`,
              status: 'VALID',
              pricePaid: ticketType.price,
            },
          });
        }
      }
    }

    if (i % 10 === 0) {
      seedLogger.success(`Created ${i + 1} orders...`);
    }
  }

  seedLogger.info(`✓ Created ${orders.length} orders total`);
  return orders;
}
