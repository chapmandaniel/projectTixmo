import { VendorCountDelta } from './types';

const BUYER_KEYS = [
  'customer_name',
  'customer_email',
  'customer_phone_number',
  'barcode_string',
  'email_on_ticket',
  'first_name_on_ticket',
  'last_name_on_ticket',
  'name_on_ticket',
  'phone_number_on_ticket',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type CountedInvoice = {
  webhookId: string;
  invoiceId: string;
  eventType: string;
  deltas: VendorCountDelta[];
};

const quantitySign = (eventType: string): number => {
  if (eventType === 'invoice.purchase') return 1;
  if (eventType === 'invoice.refund' || eventType === 'invoice.void') return -1;
  return 0;
};

/**
 * Reads only the fields required for a count. Buyer, barcode, fee, and tax
 * fields on the documented invoice payload are ignored and never returned.
 */
export const countInvoice = (payload: unknown): CountedInvoice | null => {
  if (!isRecord(payload)) return null;
  if (typeof payload.id !== 'string' || !payload.id) return null;
  if (typeof payload.webhook_event_uuid !== 'string' || !payload.webhook_event_uuid) return null;
  if (typeof payload.event_type !== 'string' || !payload.event_type) return null;
  const sign = quantitySign(payload.event_type);
  const data = isRecord(payload.data) ? payload.data : {};
  const items = Array.isArray(data.invoice_items) ? data.invoice_items : [];
  const deltas: VendorCountDelta[] = [];
  if (sign !== 0) {
    for (const item of items) {
      if (!isRecord(item)) continue;
      if (item.invoice_item_type !== undefined && item.invoice_item_type !== 'ticket') continue;
      const eventId = item.event_id;
      const ticketTypeId = item.ticket_type_id;
      const quantity = item.quantity;
      if (typeof eventId !== 'string' && typeof eventId !== 'number') continue;
      if (typeof ticketTypeId !== 'string' && typeof ticketTypeId !== 'number') continue;
      if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 0) continue;
      if (quantity === 0) continue;
      deltas.push({
        externalItemId: String(eventId),
        externalTicketTypeId: String(ticketTypeId),
        quantity: quantity * sign,
      });
    }
  }
  return {
    webhookId: payload.webhook_event_uuid,
    invoiceId: payload.id,
    eventType: payload.event_type,
    deltas,
  };
};

export const countedInvoiceHasBuyerData = (counted: CountedInvoice): boolean => {
  const serialized = JSON.stringify(counted).toLowerCase();
  return BUYER_KEYS.some((key) => serialized.includes(key));
};
