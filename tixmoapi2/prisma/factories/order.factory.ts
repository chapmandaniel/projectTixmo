import { faker } from '@faker-js/faker';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export interface OrderFactoryOptions {
  userId: string;
  eventId: string;
  orderNumber?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  totalAmount?: number;
  promoCodeId?: string | null;
}

export function createOrderData(options: OrderFactoryOptions) {
  const status = options.status || OrderStatus.PAID;
  const paymentStatus =
    options.paymentStatus ||
    (status === OrderStatus.PAID ? PaymentStatus.SUCCEEDED : PaymentStatus.PENDING);

  const totalAmount =
    options.totalAmount || faker.number.float({ min: 50, max: 500, fractionDigits: 2 });
  const feesAmount = totalAmount * 0.12; // 12% fees
  const taxAmount = totalAmount * 0.08; // 8% tax
  const discountAmount = options.promoCodeId ? totalAmount * 0.1 : 0; // 10% discount if promo code

  return {
    orderNumber: options.orderNumber || `ORD-${faker.string.alphanumeric(10).toUpperCase()}`,
    userId: options.userId,
    eventId: options.eventId,
    status,
    totalAmount: totalAmount + feesAmount + taxAmount - discountAmount,
    feesAmount,
    taxAmount,
    discountAmount,
    paymentStatus,
    paymentIntentId:
      paymentStatus === PaymentStatus.SUCCEEDED ? `pi_${faker.string.alphanumeric(24)}` : null,
    paymentMethod: paymentStatus === PaymentStatus.SUCCEEDED ? 'card' : null,
    promoCodeId: options.promoCodeId || null,
    ipAddress: faker.internet.ipv4(),
    userAgent: faker.internet.userAgent(),
  };
}
