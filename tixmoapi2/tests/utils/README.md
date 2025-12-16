# Test Utilities

This file documents `tests/utils/testUtils.ts` helpers and recommended usage for integration tests.

## Purpose
Shared helpers to reduce boilerplate in integration tests and to centralize DB cleanup logic.

## Exports
- `prisma` - shared PrismaClient instance (use with care; prefer helpers when possible)
- `safeCleanupUsers(filter = 'test')` - deletes users containing `filter` in email and dependent records
- `registerUser(app, overrides)` - registers a user via API and returns `{ user, accessToken, refreshToken }`
- `createOrganization(app, authToken, payload)` - creates org via API
- `createVenue(app, authToken, payload)` - creates venue via API
- `createEvent(app, authToken, payload)` - creates event via API
- `createTicketType(app, authToken, payload)` - creates a ticket type via API
- `createOrder(app, authToken, payload)` - creates an order via API
- `cleanupTestData()` - best-effort cleanup that calls `deleteMany` in the correct FK order

## Example
```ts
import request from 'supertest';
import app from '../../src/app';
import { registerUser, createOrganization, createEvent, cleanupTestData, prisma } from '../utils/testUtils';

beforeAll(async () => {
  await cleanupTestData();
  const reg = await registerUser(app, { email: 'test-promo@example.com', role: 'PROMOTER' });
  const org = await createOrganization(app, reg.accessToken, { name: 'Test Org' });
  const event = await createEvent(app, reg.accessToken, { organizationId: org.id });
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});
```

## Notes & Best Practices
- Always prefer helpers over direct Prisma manipulation from tests to keep test setup consistent with API behavior.
- `cleanupTestData()` is best-effort and swallows errors; use it to reset DB state between test files.
- For time-sensitive tests, use `@sinonjs/fake-timers` and only fake `Date` to avoid interfering with async internals.

