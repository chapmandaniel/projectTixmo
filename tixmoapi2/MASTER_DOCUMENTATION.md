# 📚 TixMo API - Master Documentation Index

**Last Updated**: November 2, 2025  
**Current Status**: Phase 3 Complete - 49 Endpoints  
**Version**: v1.0  
**Purpose**: Authoritative documentation resource for AI agents and developers

---

## 🎯 Document Organization & Purpose

This file serves as the **single source of truth** for all TixMo API documentation. Each document has a specific purpose and should be used appropriately.

### 📋 Documentation Structure (6 Core Files)

| Document | Purpose | When to Use | Update Frequency |
|----------|---------|-------------|------------------|
| **MASTER_DOCUMENTATION.md** ⭐ | Complete project reference, AI agent guidelines | Always read first | Every major milestone |
| **PROGRESS.md** | Current status, phase tracking, metrics (primary tracking file for sprints & AI agents) | Check status, track progress | Every milestone |
| **README.md** | Project overview, setup instructions | First-time setup, onboarding | Major changes only |
| **DEVELOPMENT_PLAN.md** | Long-term roadmap, phase definitions | Planning, strategic decisions | Monthly or major pivots |
| **API_DOCS_GUIDE.md** | How to use Swagger, test endpoints | API testing, development | When API structure changes |
| **CONTRIBUTING.md** | Code standards, PR process | Contributing code | Rarely |

> Note: This repository uses `MASTER_DOCUMENTATION.md` as the authoritative resource for AI agents. When in doubt, update `PROGRESS.md` for sprint-level tracking and update this master doc for architectural or process changes. Avoid editing deprecated/duplicate docs — consolidate edits here.

### 📜 Historical Reference

| Document | Purpose | Status |
|----------|---------|--------|
| **ARCHIVE.md** | Historical implementation notes | Complete - reference only |

**All other files should be considered implementation-level notes or historical snapshots. This is the complete, clean documentation set and the authoritative place to list where AI agents should look first.**

---

## 📊 Current Project Status (November 6, 2025)

### Overall Progress: 42%

**Completed Phases:**
- ✅ **Phase 1: Foundation** (100%) - 15 endpoints
- ✅ **Phase 2: Events** (80%) - 12 endpoints
- ✅ **Phase 3: Ticketing** (100%) - 22 endpoints

**Total Built**: 49 production-ready endpoints

### Key Metrics
- **Endpoints**: 49/120 (42%)
- **Test Coverage**: 86% (approx)
- **Tests Passing**: 118/118 (100%)
- **TypeScript Errors**: 0
- **Lint Errors**: 0 (Fixed via test file overrides)
- **Technical Debt**: 0

### What's Working
✅ Complete authentication & authorization (JWT + RBAC)  
✅ Multi-organization platform  
✅ Event & venue management  
✅ Multi-tier ticketing with inventory management  
✅ Order creation with automatic ticket generation  
✅ Ticket transfer & cancellation  
✅ Promo code discounts  
✅ Event check-in system  

### What's NOT Built Yet
❌ Real payment processing (Stripe) - ON HOLD per user request  
❌ Email notifications  
❌ Analytics dashboards  
❌ QR code generation  
❌ Advanced reporting  

---

## 🏗️ Architecture Overview

### Technology Stack
- **Runtime**: Node.js 18+, TypeScript 5
- **Framework**: Express.js
- **Database**: PostgreSQL 14
- **Cache**: Redis 7
- **ORM**: Prisma
- **Validation**: Zod
- **Testing**: Jest
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston

### Project Structure
```
tixmoapi2/
├── src/
│   ├── api/               # API modules (9 modules)
│   │   ├── auth/         # Authentication (5 endpoints)
│   │   ├── users/        # User management (4 endpoints)
│   │   ├── organizations/ # Organization management (6 endpoints)
│   │   ├── venues/       # Venue management (5 endpoints)
│   │   ├── events/       # Event management (7 endpoints)
│   │   ├── ticket-types/ # Ticket pricing (6 endpoints)
│   │   ├── orders/       # Order management (5 endpoints)
│   │   ├── tickets/      # Ticket lifecycle (6 endpoints)
│   │   └── promo-codes/  # Discount codes (5 endpoints)
│   ├── config/           # Configuration files
│   ├── middleware/       # Express middleware
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
├── prisma/               # Database schema & migrations
├── tests/                # Test suites
└── logs/                 # Application logs
```

### API Module Structure (Standard Pattern)
Each API module follows this structure:
```
module-name/
├── validation.ts   # Zod schemas for input validation
├── service.ts      # Business logic & database operations
├── controller.ts   # Request/response handling
└── routes.ts       # Route definitions + Swagger docs
```

---

## 🔌 API Endpoints Summary

### Authentication (5 endpoints)
- POST `/auth/register` - Register new user
- POST `/auth/login` - Login user
- POST `/auth/refresh` - Refresh access token
- GET `/auth/me` - Get current user (protected)
- POST `/auth/logout` - Logout (protected)

### Users (4 endpoints)
- GET `/users/:id` - Get user by ID
- PUT `/users/:id` - Update user
- DELETE `/users/:id` - Delete user (admin)
- GET `/users` - List users (admin)

### Organizations (6 endpoints)
- POST `/organizations` - Create organization
- GET `/organizations/:id` - Get organization
- PUT `/organizations/:id` - Update organization
- DELETE `/organizations/:id` - Delete organization
- GET `/organizations` - List organizations
- POST `/organizations/:id/members` - Add member

### Venues (5 endpoints)
- POST `/venues` - Create venue
- GET `/venues/:id` - Get venue
- PUT `/venues/:id` - Update venue
- DELETE `/venues/:id` - Delete venue
- GET `/venues` - List venues

### Events (7 endpoints)
- POST `/events` - Create event
- GET `/events/:id` - Get event
- PUT `/events/:id` - Update event
- DELETE `/events/:id` - Delete event
- GET `/events` - List/search events
- POST `/events/:id/publish` - Publish event
- POST `/events/:id/cancel` - Cancel event

### Ticket Types (6 endpoints)
- POST `/ticket-types` - Create ticket type
- GET `/ticket-types/:id` - Get ticket type
- PUT `/ticket-types/:id` - Update ticket type
- DELETE `/ticket-types/:id` - Delete ticket type
- GET `/ticket-types` - List by event
- POST `/ticket-types/:id/availability` - Check availability

### Orders (5 endpoints)
- POST `/orders` - Create order
- GET `/orders/:id` - Get order
- POST `/orders/:id/confirm` - Confirm order
- POST `/orders/:id/cancel` - Cancel order
- GET `/orders` - List orders

### Tickets (6 endpoints)
- GET `/tickets` - List user tickets
- GET `/tickets/:id` - Get ticket details
- POST `/tickets/:id/transfer` - Transfer ticket
- POST `/tickets/:id/cancel` - Cancel ticket
- POST `/tickets/validate` - Validate barcode
- POST `/tickets/check-in` - Check in ticket

### Promo Codes (5 endpoints)
- POST `/promo-codes` - Create promo code
- GET `/promo-codes/:id` - Get promo code
- PUT `/promo-codes/:id` - Update promo code
- DELETE `/promo-codes/:id` - Delete promo code
- GET `/promo-codes` - List promo codes
- POST `/promo-codes/validate` - Validate code

---

## 🧪 Testing Strategy

### Current Test Coverage: ~86%

**Test Files (high level):**
- `tests/unit/ApiError.test.ts` - Error utility tests
- `tests/unit/response.test.ts` - Response utility tests
- `tests/integration/app.test.ts` - Basic app tests
- `tests/integration/auth.test.ts` - Authentication tests (25 tests)
- `tests/integration/tickets.test.ts` - Tickets integration tests (now includes time-sensitive validation/check-in)
- `tests/integration/orders.test.ts` - Orders integration tests
- `tests/integration/promo-codes.test.ts` - Promo codes integration tests

**Test Helpers & Utilities**
- `tests/utils/testUtils.ts` (new) — Shared Prisma instance and helpers used across multiple integration tests. Use this file for:
  - Safe cleanup of test users and dependent records (`safeCleanupUsers(filter = 'test')`)
  - Creating test users via API (`registerUser(app, overrides)`) 
  - (Recommended) Add more helpers here: createOrganization, createEvent, createOrder to consolidate test setup.


### Quick example — using the shared test helpers
Place this at the top of an integration test file (e.g. `tests/integration/promo-codes.test.ts`):

```ts
import request from 'supertest';
import app from '../../src/app';
import { registerUser, createOrganization, createEvent, createOrder, prisma } from '../utils/testUtils';

describe('My integration tests', () => {
  let authToken: string;

  beforeAll(async () => {
    const reg = await registerUser(app, { email: 'test-promo@example.com', role: 'PROMOTER' });
    authToken = reg.accessToken;

    const org = await createOrganization(app, authToken, { name: 'Test Org' });
    const event = await createEvent(app, authToken, { organizationId: org.id });

    // Create and confirm an order that also generates tickets
    const order = await createOrder(app, authToken, { items: [{ ticketTypeId: event.defaultTicketTypeId, quantity: 1 }] });
  });
});
```

Use these helpers to reduce boilerplate and avoid FK cleanup issues. Tests should still call `prisma.$disconnect()` in `afterAll` if they open prisma connections directly.

**Time-sensitive tests**
- We use `@sinonjs/fake-timers` in `tests/integration/tickets.test.ts` to mock Date for validation/check-in tests. Implementation notes:
  - Fake only `Date` (do not fake timers globally) to avoid interfering with server async internals.
  - Create a dedicated event that starts shortly in the future, issue orders, then advance the fake clock to after start to run validations/check-ins.

**How to run tests (local)**
```bash
# Run all tests sequentially (recommended for DB-backed tests)
npm test -- --runInBand

# Run a single test file
npm test -- tests/integration/tickets.test.ts

# Typecheck
npm run typecheck
```

**Current test status**: All tests pass locally (118/118) after adding shared test utilities and time-mocking for tickets.

---

## CI & Automation

- CI workflow: `.github/workflows/ci.yml` — runs TypeScript typecheck and the full test suite (`npm run typecheck` + `npm test -- --runInBand`) on pushes and PRs to `main`.
- Local CI commands: use `npm run typecheck` and `npm test -- --runInBand` to mirror CI behavior.
- Consider adding coverage gating and test artifact uploads in CI if required.

### ESLint Configuration & Lint Errors (Fixed Nov 6, 2025)

**Issue**: Enabling `@typescript-eslint/recommended-requiring-type-checking` caused a spike from 10 to 350+ lint errors, primarily from test files using `any` types and dynamic response objects.

**Solution**: Added ESLint overrides in `.eslintrc.json` for test files (`tests/**/*.ts`) to relax strict type-aware rules while maintaining them for production code in `src/`.

**Disabled rules in tests only**:
- `@typescript-eslint/no-unsafe-assignment`
- `@typescript-eslint/no-unsafe-member-access`
- `@typescript-eslint/no-unsafe-call`
- `@typescript-eslint/no-unsafe-return`
- `@typescript-eslint/no-unsafe-argument`
- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/no-var-requires`
- `no-empty`

**Current Status**: All lint checks pass with 0 errors/warnings. Production code maintains strict type safety.

**Commands**:
```bash
# Run lint check
npm run lint

# Run lint with auto-fix
npm run lint:fix

# Run typecheck
npm run typecheck
```

## Tests & Test Utilities

All shared test utilities are located in `tests/utils/testUtils.ts` and documented in `tests/utils/README.md`. Key helpers:

- `registerUser(app, overrides)` — registers a user and returns `{ user, accessToken, refreshToken }`.
- `createOrganization(app, authToken, payload)` — create an organization via API.
- `createVenue(app, authToken, payload)` — create a venue via API.
- `createEvent(app, authToken, payload)` — create an event via API.
- `createTicketType(app, authToken, payload)` — create a ticket type via API.
- `createOrder(app, authToken, payload)` — create an order via API.
- `cleanupTestData()` — best-effort DB cleanup (deletes in FK-safe order) — use in `beforeAll`/`afterAll` for tests.

Update these docs if you change helper signatures.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Docker Desktop or Colima
- PostgreSQL 14
- Redis 7

### Quick Start
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start database & cache
docker-compose up -d

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev

# Run tests
npm test

# View API documentation
open http://localhost:3000/api/v1/docs
```

### Environment Variables
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/tixmo
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

---

## 📝 Development Workflow

### Adding a New API Module

1. **Create module directory**: `src/api/module-name/`

2. **Create validation**: `validation.ts`
   - Define Zod schemas for input validation
   - Export schema objects

3. **Create service**: `service.ts`
   - Implement business logic
   - Database operations using Prisma
   - Export service instance

4. **Create controller**: `controller.ts`
   - Handle requests/responses
   - Use catchAsync wrapper
   - Call service methods

5. **Create routes**: `routes.ts`
   - Define Express routes
   - Add Swagger documentation
   - Apply middleware (auth, validation)

6. **Register routes**: Add to `src/api/index.ts`

7. **Update Swagger**: Add tag to `src/config/swagger.ts`

8. **Write tests**: Create integration tests in `tests/integration/`

9. **Update docs**: Update PROGRESS.md and this file

---

## 🔒 Security & Authentication

### Authentication Flow
1. User registers/logs in → Receives access token (15 min) + refresh token (7 days)
2. Include access token in Authorization header: `Bearer <token>`
3. Token expires → Use refresh token to get new access token
4. Logout → Token added to blacklist (stored in Redis)

### Authorization (RBAC)
- **ADMIN**: Full system access
- **PROMOTER**: Create events, manage tickets
- **CUSTOMER**: Purchase tickets, view own data
- **SCANNER**: Check in tickets at events

### Protected Routes
All routes except `/auth/register` and `/auth/login` require authentication.

---

## 📈 Performance & Scalability

### Current Optimizations
- Redis caching for session management
- Database indexing on frequently queried fields
- Transaction-based inventory management (prevents race conditions)
- Pagination on all list endpoints

### Known Bottlenecks
- None identified yet (low traffic)

### Planned Optimizations
- Add Redis caching for frequently accessed data
- Implement rate limiting
- Add database connection pooling
- Optimize N+1 queries

---

## 🐛 Known Issues & Limitations

### Current Limitations
1. **No payment processing** - Orders simulate payment confirmation
2. **No email notifications** - Users don't receive confirmations
3. **No QR code generation** - Tickets have barcodes but no visual QR
4. **Basic search** - No advanced filtering or full-text search
5. **No analytics** - No reporting dashboards
6. **Single currency** - No multi-currency support

### Technical Debt
✅ **None!** - Zero TypeScript errors, clean codebase

---

## 📅 Roadmap

### Completed
- ✅ Phase 1: Foundation (100%)
- ✅ Phase 2: Events (80%)
- ✅ Phase 3: Ticketing (100%)

### Next (When Payment Hold is Lifted)
- ⏸️ **Phase 4: Payment Integration** (ON HOLD)
  - Stripe integration
  - Payment intents
  - Webhooks
  - Refunds

### Future Phases
- Phase 5: Notifications (Email/SMS)
- Phase 6: Analytics & Reporting
- Phase 7: QR Code Generation
- Phase 8: Advanced Search
- Phase 9: Mobile API Enhancements
- Phase 10: Production Hardening

---

## 🤖 AI Agent Guidelines

### For Code Changes
1. **Always check PROGRESS.md first** - Know what's built
2. **Follow module structure** - Use validation → service → controller → routes pattern
3. **Match Prisma schema** - Check `prisma/schema.prisma` for correct field names
4. **Run TypeScript check** - `npm run typecheck` after changes
5. **Update tests** - Add/update test coverage
6. **Update PROGRESS.md** - Reflect completed work
7. **When updating tests** - Prefer using `tests/utils/testUtils.ts` for setup/cleanup to avoid duplicate DB teardown logic

### For Status Updates
1. **Update PROGRESS.md** - Primary status tracking document
2. **Update this file** - For major architectural changes
3. **Don't update deprecated docs** - NEXT_STEPS.md, WHATS_NEXT.md, etc.

---

## 📞 Support & Resources

### Documentation
- **Swagger UI**: http://localhost:3000/api/v1/docs
- **OpenAPI JSON**: http://localhost:3000/api/v1/docs/openapi.json
- **Export without running server**:
  - npm run docs:openapi
  - Output: ./openapi.json

See API_DOCS_GUIDE.md for full instructions, schemas overview, and troubleshooting.

### Commands
```bash
# Install dependencies
npm install

# Run tests sequentially (DB-backed)
npm test -- --runInBand
```

---

(End of master documentation)
