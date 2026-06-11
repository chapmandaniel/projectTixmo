#!/usr/bin/env node

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000/api/v1';
const DEFAULT_EVENT_SLUG = 'market-demo-harborlight-summer-session';
const DEFAULT_TICKET_NAME = 'General Admission';
const BUYER_PASSWORD = 'BuyerPass123!';

const args = process.argv.slice(2);

const getArgValue = (name, fallback) => {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = args.indexOf(name);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }

  return fallback;
};

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`Local checkout smoke

Usage:
  npm run smoke:checkout:local
  npm run smoke:checkout:local -- --api-base-url http://127.0.0.1:3000/api/v1
  npm run smoke:checkout:local -- --event-slug market-demo-harborlight-summer-session

This smoke expects the local API to be running and the market demo org to be seeded.
It creates a temporary buyer, creates one pending order, checks payment-intent behavior,
and cancels the pending order to release held inventory.

Environment:
  TIXMO_API_BASE_URL      API base URL. Defaults to ${DEFAULT_API_BASE_URL}
  TIXMO_EVENT_SLUG        Public event slug. Defaults to ${DEFAULT_EVENT_SLUG}
  TIXMO_TICKET_NAME       Ticket type to buy. Defaults to ${DEFAULT_TICKET_NAME}
`);
  process.exit(0);
}

const apiBaseUrl = getArgValue(
  '--api-base-url',
  process.env.TIXMO_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, '');
const eventSlug = getArgValue('--event-slug', process.env.TIXMO_EVENT_SLUG || DEFAULT_EVENT_SLUG);
const ticketName = getArgValue('--ticket-name', process.env.TIXMO_TICKET_NAME || DEFAULT_TICKET_NAME);

const request = async (path, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
};

const assertStatus = (label, response, expectedStatus) => {
  if (response.status !== expectedStatus) {
    throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(response.body)}`);
  }
};

const main = async () => {
  const eventResponse = await request(`/events/public/${eventSlug}`);
  assertStatus('Public event lookup', eventResponse, 200);

  const event = eventResponse.body.data;
  const ticketTypes = event?.ticketTypes || [];
  const ticketType = ticketTypes.find((ticket) => ticket.name === ticketName) || ticketTypes[0];
  if (!ticketType) {
    throw new Error(`No active ticket types were returned for ${eventSlug}`);
  }

  const buyerEmail = `checkout-smoke-${Date.now()}@tixmo.test`;
  const registerResponse = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: buyerEmail,
      password: BUYER_PASSWORD,
      firstName: 'Checkout',
      lastName: 'Smoke',
    }),
  });
  assertStatus('Buyer registration', registerResponse, 201);

  const accessToken = registerResponse.body.data?.accessToken;
  if (!accessToken) {
    throw new Error('Buyer registration did not return an access token');
  }

  const orderResponse = await request('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }),
  });
  assertStatus('Order creation', orderResponse, 201);

  const order = orderResponse.body.data;
  let paymentIntentResponse;
  try {
    paymentIntentResponse = await request('/payments/create-intent', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ orderId: order.id }),
    });
  } finally {
    const cancelResponse = await request(`/orders/${order.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (cancelResponse.status !== 200 || cancelResponse.body.data?.status !== 'CANCELLED') {
      throw new Error(`Order cleanup failed with ${cancelResponse.status}: ${JSON.stringify(cancelResponse.body)}`);
    }
  }

  const acceptablePaymentStatuses = new Set([200, 503]);
  if (!acceptablePaymentStatuses.has(paymentIntentResponse.status)) {
    throw new Error(
      `Payment intent returned unexpected ${paymentIntentResponse.status}: ${JSON.stringify(paymentIntentResponse.body)}`
    );
  }

  const paymentConfigured = paymentIntentResponse.status === 200;
  const summary = {
    apiBaseUrl,
    eventSlug: event.slug,
    eventName: event.name,
    ticketType: ticketType.name,
    buyerEmail,
    orderId: order.id,
    orderStatus: orderResponse.status,
    paymentIntentStatus: paymentIntentResponse.status,
    paymentConfigured,
    paymentIntentMessage: paymentIntentResponse.body.message || '',
    cleanup: 'cancelled',
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
};

main().catch((error) => {
  process.stderr.write(`[smoke:checkout:local] ${error.message}\n`);
  process.exit(1);
});
