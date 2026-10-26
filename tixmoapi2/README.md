<!-- Add authoritative banner to point to MASTER_DOCUMENTATION.md -->
> NOTE: `MASTER_DOCUMENTATION.md` is the authoritative documentation for this project and AI agents. For sprint-level tracking and status updates use `PROGRESS.md`.

# 🎫 TixMo API

**Enterprise-grade event ticketing platform**

[![Status](https://img.shields.io/badge/status-phase%203%20complete-success)](https://github.com)
[![CI](https://img.shields.io/badge/ci-configured-blue)](https://github.com)
[![TypeScript](https://img.shields.io/badge/typescript-5.2-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-143%2F143%20passing-success)](https://github.com)
[![Coverage](https://img.shields.io/badge/coverage-86%25-success)](https://github.com)

> **📚 For comprehensive documentation, see [MASTER_DOCUMENTATION.md](./MASTER_DOCUMENTATION.md)**

---

## 📊 Project Status (December 13, 2025)

**Current Phase**: Phase 4 Complete - 52 Endpoints Built! 🎉  
**Progress**: 48% complete (way ahead of schedule!)  
**Health**: 🟢 **EXCELLENT** - 0 TypeScript errors, 0 technical debt

### ✅ What's Working Now

- ✅ **Complete Authentication System** (5 endpoints)
- ✅ **User & Organization Management** (10 endpoints)
- ✅ **Event & Venue Management** (12 endpoints)
- ✅ **Ticketing System** (22 endpoints)
  - Multi-tier pricing
  - Order management with inventory control
  - Ticket transfer & cancellation
  - Promo code discounts
  - Event check-in system
- ✅ **Production Infrastructure** - PostgreSQL, Redis, Prisma ORM
- ✅ **Comprehensive Testing** - 143/143 tests passing, 87% coverage
- ✅ **Full Swagger Documentation** - http://localhost:3000/api/v1/docs

### 📈 Progress Summary

| Phase | Status | Endpoints | Completion |
|-------|--------|-----------|------------|
| Phase 1: Foundation | ✅ Complete | 15 | 100% |
| Phase 2: Events | ✅ Complete | 12 | 80% |
| Phase 3: Ticketing | ✅ Complete | 22 | 100% |
| Phase 4: Payments | ✅ Complete | 3 | 100% |
| **Total** | **In Progress** | **52** | **48%** |

**See [PROGRESS.md](./PROGRESS.md) for detailed tracking.**

## Continuous Integration

This repository includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs TypeScript typechecking and the full test suite on pushes and pull requests to `main`.

If you'd like to run CI locally, the two main commands executed by CI are:

```bash
npm run typecheck
npm test -- --runInBand
```

## Test utilities

Shared test utilities live in `tests/utils/testUtils.ts`. Documentation and usage examples are in `tests/utils/README.md`.

### Managed CI HTTP pressure

The collected `orders-http-pressure.test.ts` schedules 1,800 authenticated synthetic
requests at 30 per second for 60 seconds. Successful HTTP 201 reservations must
have p95 <= 2 seconds; all-attempt latency is reported separately so fast sold-out
responses cannot hide the successful-reservation tail.
Use the existing guarded managed-CI disposable PostgreSQL/Redis setup, never a
shared application target. Its read/write/admission maxima are explicitly 4,000
for this suite; aggregate receipts bind the source SHA and workflow run and report
`syntheticMaxima: 4000` and `limitsQualified: false`. This does not qualify deployed
limits, browser concurrency, ramp/soak traffic, paid-ticket latency or full capacity.
A successful actual run and independent review are required for this slice.


---

## 🚀 Quick Start

### Managed CI authenticated HTTP actor ramp

`orders-http-ramp.test.ts` runs fresh 100, 250 and 500 actor stages, each with a
20-second nominal schedule: ten public event reads at a two-second cadence, one
checkout offered across seconds 4–16, then one authenticated order-recovery read.
Each actor has at most one request in flight. Actual actor lifetimes must overlap
for at least 14 seconds; simultaneous HTTP requests are measured separately.
Successful public-read p95 must be <= 500 ms and reservation p95 <= 2 seconds;
unexpected 5xx must remain below 0.5%, with 429, 503 and network deadlines failing
explicitly. Scheduling lateness, missed cadence and actual offered/completion rates
are reported. Suite-only read/write/admission maxima are 10000/4000/4000 and
`limitsQualified` stays false. Generated JWT actors do not qualify login limits.
CPU, memory and event-loop observations combine the API and load driver in one
Jest process; PostgreSQL connection/lock and Redis numeric observations cover only
the owned CI services. This is not browser, deployed-limit, region-latency,
30-minute soak, payment-queue or paid-ticket capacity proof.

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **PostgreSQL** 14+
- **Redis** 7+
- **Colima** or Docker Desktop (for containerized services)

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd tixmoapi2

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration:
# - DATABASE_URL
# - REDIS_URL
# - JWT_SECRET
# - JWT_REFRESH_SECRET

# 4. Start database services
docker-compose up -d
# OR with Colima:
# colima start
# docker-compose up -d

# 5. Run database migrations
npx prisma migrate dev

# 6. Generate Prisma client
npx prisma generate

# 7. Start development server
npm run dev
```

The server will start at `http://localhost:3000`

### Verify Installation

```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"...","uptime":X,"environment":"development"}

# View API documentation
open http://localhost:3000/api/v1/docs
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## 📚 API Endpoints (52 Total)

### Authentication (5 endpoints) ✅
```
POST   /api/v1/auth/register    - Register new user
POST   /api/v1/auth/login       - Login with email/password
POST   /api/v1/auth/refresh     - Refresh access token
GET    /api/v1/auth/me          - Get current user (protected)
POST   /api/v1/auth/logout      - Logout (protected)
```

### Users (4 endpoints) ✅
```
GET    /api/v1/users/:id        - Get user by ID
PUT    /api/v1/users/:id        - Update user
DELETE /api/v1/users/:id        - Delete user (admin)
GET    /api/v1/users            - List users (admin)
```

### Organizations (6 endpoints) ✅
```
POST   /api/v1/organizations              - Create organization
GET    /api/v1/organizations/:id          - Get organization
PUT    /api/v1/organizations/:id          - Update organization
DELETE /api/v1/organizations/:id          - Delete organization (admin)
GET    /api/v1/organizations              - List organizations
POST   /api/v1/organizations/:id/members  - Add member
```

### Venues (5 endpoints) ✅
```
POST   /api/v1/venues           - Create venue
GET    /api/v1/venues/:id       - Get venue
PUT    /api/v1/venues/:id       - Update venue
DELETE /api/v1/venues/:id       - Delete venue (admin)
GET    /api/v1/venues           - List venues
```

### Events (7 endpoints) ✅
```
POST   /api/v1/events               - Create event
GET    /api/v1/events/:id           - Get event
PUT    /api/v1/events/:id           - Update event
DELETE /api/v1/events/:id           - Delete event (admin)
GET    /api/v1/events               - List/search events
POST   /api/v1/events/:id/publish   - Publish event
POST   /api/v1/events/:id/cancel    - Cancel event
```

### Ticket Types (6 endpoints) ✅
```
POST   /api/v1/ticket-types                  - Create ticket type
GET    /api/v1/ticket-types/:id              - Get ticket type
PUT    /api/v1/ticket-types/:id              - Update ticket type
DELETE /api/v1/ticket-types/:id              - Delete ticket type (admin)
GET    /api/v1/ticket-types                  - List by event
POST   /api/v1/ticket-types/:id/availability - Check availability
```

### Orders (5 endpoints) ✅
```
POST   /api/v1/orders              - Create order
GET    /api/v1/orders/:id          - Get order
POST   /api/v1/orders/:id/confirm  - Confirm order (payment)
POST   /api/v1/orders/:id/cancel   - Cancel order
GET    /api/v1/orders              - List orders
```

### Tickets (6 endpoints) ✅
```
GET    /api/v1/tickets                - List user tickets
GET    /api/v1/tickets/:id            - Get ticket details
POST   /api/v1/tickets/:id/transfer   - Transfer ticket
POST   /api/v1/tickets/:id/cancel     - Cancel ticket
POST   /api/v1/tickets/validate       - Validate barcode
POST   /api/v1/tickets/check-in       - Check in ticket
```

### Promo Codes (5 endpoints) ✅
```
POST   /api/v1/promo-codes          - Create promo code
GET    /api/v1/promo-codes/:id      - Get promo code
PUT    /api/v1/promo-codes/:id      - Update promo code
DELETE /api/v1/promo-codes/:id      - Delete promo code (admin)
GET    /api/v1/promo-codes          - List promo codes
POST   /api/v1/promo-codes/validate - Validate code
```

### Payments (3 endpoints) ✅
```
POST   /api/v1/payments/create-intent - Create payment intent
POST   /api/v1/payments/webhook       - Stripe webhook (subscribe charge.dispute.created and charge.dispute.closed)
GET    /api/v1/payments/status/:id    - Get payment status (planned)
```

**For interactive API testing, visit:** http://localhost:3000/api/v1/docs
GET    /api/v1/auth/me          - Get current user (protected)
POST   /api/v1/auth/logout      - Logout user (protected)
```

### User Management (🚧 In Progress)

```
GET    /api/v1/users/:id        - Get user by ID
PUT    /api/v1/users/:id        - Update user
DELETE /api/v1/users/:id        - Delete user (admin)
GET    /api/v1/users            - List users (admin)
```

### Coming Soon

- Organizations API
- Venues API
- Events API
- Tickets API
- Orders API
- Payments API

**Total Target**: 120+ endpoints by MVP launch

---

## 🏗️ Tech Stack

### Core

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.2
- **Framework**: Express.js 4.18
- **Database**: PostgreSQL 14
- **ORM**: Prisma 5.5
- **Cache**: Redis 7

### Security

- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: Zod
- **Security Headers**: Helmet
- **Rate Limiting**: express-rate-limit

### Development

- **Testing**: Jest
- **Linting**: ESLint (Airbnb style)
- **Formatting**: Prettier
- **Logging**: Winston
- **Hot Reload**: Nodemon

### Infrastructure

- **Containers**: Colima / Docker
- **CI/CD**: GitHub Actions (planned)
- **Monitoring**: Datadog (planned)
- **Error Tracking**: Sentry (planned)

---

## 📁 Project Structure

```
tixmoapi2/
├── src/
│   ├── api/              # API routes and controllers
│   │   ├── auth/         # Authentication endpoints ✅
│   │   ├── users/        # User management 🚧
│   │   └── index.ts      # API router
│   ├── config/           # Configuration files
│   │   ├── database.ts   # Database config
│   │   ├── environment.ts # Environment variables
│   │   ├── logger.ts     # Winston logger
│   │   ├── prisma.ts     # Prisma client
│   │   └── redis.ts      # Redis client
│   ├── middleware/       # Express middleware
│   │   ├── auth.ts       # JWT authentication
│   │   ├── authorize.ts  # RBAC authorization
│   │   ├── validate.ts   # Input validation
│   │   └── errorHandler.ts
│   ├── utils/            # Utility functions
│   │   ├── ApiError.ts   # Error class
│   │   ├── catchAsync.ts # Async error handler
│   │   ├── jwt.ts        # JWT utilities
│   │   ├── password.ts   # Password utilities
│   │   └── response.ts   # Response helpers
│   ├── types/            # TypeScript types
│   ├── app.ts            # Express app setup
│   └── index.ts          # Entry point
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # E2E tests (planned)
├── prisma/
│   ├── schema.prisma     # Database schema (8 tables)
│   └── migrations/       # Database migrations
├── logs/                 # Application logs
└── docs/                 # Documentation (10 files)
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts
```

**Current Status**: 143/143 tests passing (100% success rate)

---

## 📖 Documentation

Comprehensive documentation is available in the following files:

- **[DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)** - 32-week development roadmap
- **[PROGRESS.md](PROGRESS.md)** - Live progress tracking and metrics
- **[NEXT_STEPS.md](NEXT_STEPS.md)** - Detailed action plan for upcoming work
- **[READY_TO_RUN.md](READY_TO_RUN.md)** - Quick start guide
- **[AUTH_IMPLEMENTATION.md](AUTH_IMPLEMENTATION.md)** - Authentication system docs
- **[QUICKSTART.md](QUICKSTART.md)** - Developer onboarding guide
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines

---

## 🔐 Security

- ✅ JWT-based authentication (15min access, 7d refresh)
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Role-based access control (RBAC)
- ✅ Input validation with Zod schemas
- ✅ Helmet security headers
- ✅ Rate limiting
- ⏸️ OAuth2 (planned)
- ⏸️ Two-factor authentication (planned)
- ⏸️ Security audit (planned for Phase 8)

---

## 🚀 Development Roadmap

### Phase 1: Foundation (85% Complete) - Oct 28 - Nov 3
- [x] Infrastructure setup
- [x] Authentication system
- [ ] User & organization management
- **Endpoints**: 60
- **Tests**: 157 passing

## 🗺 Roadmap

- [x] **Phase 1: Foundation** (Project setup, Database, Auth)
- [x] **Phase 2: Core Resources** (Users, Organizations, Venues, Events)
- [x] **Phase 3: Ticketing Engine** (Ticket Types, Orders, Inventory)
- [x] **Phase 4: Payment Integration** (Stripe, Webhooks)
- [x] **Phase 5: Notifications** (Email, In-app)
- [x] **Phase 6: QR Code & Enhanced Validation** (Scanning, Offline Sync)
- [x] **Phase 7: Reporting & Analytics** (Sales reports, Attendance)
- [x] **Phase 8: Advanced Features** (Waitlists, Promo codes)c 2025 - Jun 2026
- QR codes & check-in
- Admin dashboard
- Performance optimization
- Security audit
- **Production launch: June 28, 2026**

**See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for complete roadmap.**

---

## 📊 Key Metrics

| Metric | Target (MVP) | Current | Status |
|--------|--------------|---------|--------|
| API Endpoints | 120 | 5 | 🟡 4% |
| Database Tables | 15 | 8 | 🟢 53% |
| Test Cases | 500+ | 12 | 🟡 2% |
| Code Coverage | >80% | 40% | 🟡 50% |
| Documentation | 50+ pages | 10 | 🟢 20% |

**Timeline**: On track, currently ahead of schedule by ~1 week

---

## 🤝 Contributing

This is a proprietary project. For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 License

Proprietary - All rights reserved

---

## 📞 Contact & Support

- **Documentation**: See `docs/` folder
- **Issues**: Check logs in `logs/` folder
- **Progress**: Track in [PROGRESS.md](PROGRESS.md)

---

## 🎉 Achievements

- ✅ Built complete auth system in 4 hours
- ✅ 20+ hours server uptime (stable)
- ✅ 12/12 tests passing (100% success)
- ✅ Zero technical debt
- ✅ 6x development velocity (ahead of schedule)

**The foundation is solid. Ready to build the skyscraper.** 🏗️

---

_Last updated: October 29, 2025_

### Opt-in long HTTP soak (#610)

The dedicated `http-soak-qualification.yml` job runs only for the explicit PR
branch `codex/http-soak-qualification`, with job-owned PostgreSQL 18 and Redis
8.2.9. It admits only fixed synthetic loopback services. The 50-minute job runs
one real monotonic 1,800,000 ms steady window after setup, with 200 authenticated
HTTP actors. These are not browser contexts. Ordinary Jest and market gates do
not discover the `*.soak.ts` suite.

Each actor browses a public event and its own wallet every 10 seconds (180
cycles), and reserves, reads, then cancels one unit every 60 seconds (30 cycles).
Actors are staggered; a missed slot is counted and skipped without catch-up.
All 6,000 cancelled orders/tickets remain for the final uniqueness and inventory
audit. Each wallet also contains one directly seeded synthetic PAID/SOLD ticket;
its complete financial/ticket rows stay unchanged. This seed does not qualify
paid fulfillment or provider latency. Holds must be released within 10 seconds.

The runner explicitly uses synthetic 15-minute access / 45-minute refresh JWTs,
not the default 7-day access lifetime. Initial tokens come from mounted login;
refresh is mounted HTTP, scheduled from each actual token expiry minus a minute,
including setup time. Each original token must later receive a native 401.
These expected expiry probes are reported separately from unexpected failures.
No tokens are regenerated by the test after the window starts.

Six separate five-minute buckets gate public, wallet and order-read p95 at 500 ms
and successful HTTP 201 reservation p95 at 2,000 ms. Unexpected status, 429, 503,
network/deadline errors, malformed successes, missed slots and duplicate/changed
financial effects fail the test. Tail requests draining after the window are
counted separately, checked for correctness, and do not enlarge its duration.
The aggregate-only receipt binds the source SHA and run attempt; raw child output
is suppressed. The outer runner owns detached child process groups, bounds and
discards child output, and joins close plus group absence before report access
or deletion. A failed join preserves reports and emits no success. All HTTP,
middleware, Redis and setup/cleanup work is joined;
unjoined work permanently preserves context for managed job teardown.

Synthetic controls are read 10,000, write 4,000 and admission 4,000, explicitly
`limitsQualified=false`. Generated benchmarking IP headers distribute setup
logins; this is not a shared-IP login-limit qualification. CPU/RSS/heap/event-loop
samples describe the combined API and load-driver Jest process; PostgreSQL and
Redis observations describe only owned CI services. Queue samples cover this
unpaid workload; recovery jobs are not started. No provider traffic, deployed
limits, browser capacity, regional latency, outage recovery, paid latency or
complete #246 acceptance is inferred. Owned fixture deletion and connection
cleanup must pass; hosted execution remains required before accepting results.

### Native scheduled recovery timing (#612)

`tests/integration/payment-native-recovery.test.ts` is an ordinary collected SQL
case. It starts the actual payment recovery singleton job, observes its immediate
synthetic transport failure and persisted retry timestamp, restores only the
in-process synthetic transport, then measures recovery on the unchanged native
60-second interval. No direct recovery invocation, fake clock or post-restoration
SQL timestamp rewrite advances retries. A tick just before the persisted 60-second
backoff can legitimately defer settlement to the following tick. Settlement must
complete within 300,000 ms after restoration; one more actual tick must preserve
the complete settled financial/ticket/stock snapshot with exactly one synthetic
refund effect. Manual late-payment and foreign fixtures remain unchanged.

The usual run is approximately two to three minutes; the case has a 390-second
body bound and 450-second Jest limit. The interval is stopped and every observed
actual recovery promise joined before strictly owned fixture deletion and
connection teardown. A failed join permanently preserves context for managed
cleanup. Real provider and notification transport is refused. This measures
synthetic scheduled recovery on disposable CI services, not Stripe availability,
production outage recovery, readiness/monitor delivery or whole #246 acceptance.

The market workflow clears the owned receipt before execution and reports only
validated source/run-bound numeric and boolean aggregates afterward. For a fresh
standalone disposable run, clear it with
`node scripts/native-recovery-receipt.cjs clear` before selecting this case.

#### Soak harness retention comparison (#613)

The successor keeps the complete real 30-minute, 200-actor workload and all
latency, authentication, inventory and cleanup gates. High-volume middleware
and Redis observations now use plain functions preserving receivers, arguments,
exact return values and rejection/next behavior; their only live bookkeeping is
the existing set of unfinished promises. They do not store Jest call histories.
The fixture logger is also a plain no-op object. Original properties are restored
only after the existing joined-work and permanent-unsafe checks permit cleanup.
Low-volume factory/config test seams remain unchanged.

Receipt `harnessVersion: 2` adds only fixed numeric sample counts and RSS/heap
maxima to each of the six five-minute buckets, grouped by sample completion time.
These still describe the combined API and driver process. Global maxima retain
the existing scope, including draining samples. There is no invented memory
budget or claim that this separates an application leak from all driver costs.
The original #610 pass remains evidence for its exact historical harness; a
version-2 result requires its own full-duration execution and source/run binding.

After independent review, the operator can update the existing explicit
`codex/http-soak-qualification` branch against its expected current head and open
a successor PR. The same fixed-branch, 50-minute job checks out that immutable PR
head and runs the full workload; no shorter rerun, timer substitution, target load
or provider traffic qualifies this comparison. No successor result is inferred
from source or inert tests alone.

### Synthetic mounted payment-to-ticket visibility (#616)

The collected `payment-http-visibility.test.ts` scenario uses 20 distinct owned
buyers and at most four HTTP requests in flight. Actual mounted reservation and
intent preparation run against real SQL and Redis. Only processor intent
create/retrieve calls and outbound email transport are simulated; the real SDK
signs and verifies exact webhook bytes through the application's raw-body parser,
controller and fulfillment transaction. Wrong signatures and tampered bytes must
leave the complete pending financial/inventory snapshot unchanged.

After synthetic payment confirmation, a monotonic timer includes callback HTTP,
owned-wallet visibility and the first HTTP QR generation. Paid-to-first-QR p95
must be at most 30,000 ms over all 20 samples. Intent-to-QR p95 and maximum remain
reported as `fixture-context-only`: that clock also includes deliberate unpaid
waiting during the 20-intent batch and negative-signature phase. It is a context
metric, not a payment fulfillment acceptance gate. Its timer is not reset or
shortened to remove that waiting. This is local application callback latency under this
small synthetic workload, not real Stripe delivery/challenge time, inbox delivery,
paid latency at 500 actors or complete #246/#244 qualification. Setup JWT fixtures
do not qualify login throughput.

The full replay baseline is captured after first QR caching, which legitimately
writes QR metadata. Same-ID and distinct signed callback replays must preserve
all order, attempt, ticket, receipt and inventory fields, with one intent and one
inert receipt acknowledgement per buyer, one SOLD allocation per ticket, and no
refunds. Foreign wallet/QR denial and an unchanged foreign fixture are checked.
Every middleware/Redis/server/HTTP continuation is joined before owned fixture
cleanup; a deadline never authorizes deleting context with work still running.
The market workflow clears and validates a fixed source/run-bound aggregate
receipt. No token, signature, client secret, customer row or message body is
printed. A hosted actual pass and independent review remain mandatory.

This fixture explicitly uses read 10,000 / write 4,000 / admission 4,000 synthetic
controls, restored after joined cleanup; `limitsQualified=false`. Shared CI
limiter history must not be confused with deployed admission or rate-budget proof.

### Emulated two-session scanner integration (#615)

The collected `scanner-browser.test.ts` builds the current frontend and uses two
independent headless Chrome processes with separate temporary profiles. Both use
`/scan`, real scanner-key authentication and documented manual full-QR entry.
Two actual scan requests arrive at a barrier before the real ticket-locking
service runs. Exactly one UI admission and one rejection must match one successful
SQL ENTRY log and two attempts. An explicit duplicate is denied; after actual
scanner revocation the still-connected second UI cannot admit a fresh paid QR.
Keys are checked absent from browser storage, URLs and raw profile bytes after
Chrome stops; no credential or fixture identifiers enter aggregate receipts.
Owned financial/foreign rows, unscanned paid tickets and stock must remain intact.
Browser groups, CDP handlers, frontend/API servers, middleware/Redis work and owned
fixtures must join and clean up; uncertainty preserves context and fails.

This is an emulated browser/HTTP/SQL proof. It does not qualify physical iOS or
Android devices, optical decoding, offline admission, gate operators or whole
#247. Source acceptance and a fresh hosted run are required independently.

### Secure validation rollback baseline (#619/#621)

A PR sets `OLD_COMMIT` and the configured-image-restore workflow `ref` to the
main commit it is based on, never to its own commit. The job proves the PR
image can roll back to that previous main image. `parity()` requires that
commit to be an ancestor of `origin/main` and to differ from or predate the
candidate under test. The real new-old-new rehearsal still preserves retained
synthetic writes and requires joined cleanup. Its receipt keeps rollback
promotion approval false: a CI compatibility test never authorizes a deployment
by itself.
