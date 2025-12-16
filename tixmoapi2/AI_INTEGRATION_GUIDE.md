# TixMo API - AI/Dashboard Integration Guide

## 🎯 Purpose
A concise info package for an AI agent to kick off a React/TypeScript dashboard that interfaces with the TixMo API.

---

## 🔗 Canonical Docs and Spec
- Swagger UI (interactive): http://localhost:3000/api/v1/docs
- OpenAPI JSON (machine-readable): http://localhost:3000/api/v1/docs/openapi.json
- Export spec to file (no server needed):
  - npm run docs:openapi
  - Output: ./openapi.json

---

## ✅ Dashboard Kickoff Checklist (for AI)
1) Ingest the OpenAPI spec
   - Prefer URL above or the exported ./openapi.json
2) Generate types/client
   - Types only: npx openapi-typescript ./openapi.json -o ./src/types/api.ts
   - Full client: npx @openapitools/openapi-generator-cli generate -i ./openapi.json -g typescript-axios -o ./src/api/generated
3) Implement API client wrapper
   - Base URL: http://localhost:3000/api/v1
   - Auth: Bearer access token in Authorization header
   - Refresh flow on 401 via POST /auth/refresh
4) Add auth context and protected routes
   - Store accessToken/refreshToken securely (memory + refresh strategy)
5) Build initial pages
   - Login, Dashboard (analytics), Events, Orders, Tickets
6) Add data fetching with React Query
   - Caching, loading/error states, polling for live data
7) Wire charts for analytics
   - Recharts or Chart.js
8) Implement pagination and filters on list views

---

## 🔐 Authentication Contract
- Login: POST /auth/login → returns accessToken and refreshToken
- Use: Add header Authorization: Bearer <accessToken>
- Refresh: POST /auth/refresh with refreshToken to get a new access token
- Roles: ADMIN, PROMOTER, CUSTOMER, SCANNER (see User schema)

---

## 📦 API Client Pattern (Axios)
Create a small client wrapper with interceptors.

- Base URL: http://localhost:3000/api/v1
- Default headers: Content-Type: application/json
- Attach Authorization automatically if token present
- On 401, attempt refresh once; if fails, logout

---

## 🔁 Data Fetching Pattern (React Query)
- useQuery for reads
- useMutation for writes
- Refetch relevant queries after mutations
- Poll high-frequency endpoints for live dashboards

Suggested polling cadence:
- Every 5s: GET /events/:id/occupancy, GET /scanners/logs?page=1&limit=20
- Every 30s: GET /analytics/dashboard, GET /events/:id/stats

---

## 🧭 Primary Endpoints for a Dashboard

Authentication
- POST /auth/register, POST /auth/login, POST /auth/refresh, GET /auth/me, POST /auth/logout

Analytics (core dashboard)
- GET /analytics/dashboard (summary)
- GET /analytics/sales
- GET /analytics/events
- GET /analytics/customers

Event Monitoring
- GET /events (list/search)
- GET /events/:id (details)
- POST /events/:id/publish
- POST /events/:id/cancel
- GET /events/:id/occupancy
- GET /events/:id/stats
- GET /events/:id/timeline

Orders & Tickets
- POST /orders, GET /orders/:id, POST /orders/:id/confirm, POST /orders/:id/cancel, GET /orders
- GET /tickets, GET /tickets/:id, POST /tickets/:id/transfer, POST /tickets/:id/cancel

Promo Codes
- POST /promo-codes, GET /promo-codes/:id, PUT /promo-codes/:id, DELETE /promo-codes/:id, GET /promo-codes, POST /promo-codes/validate

Scanners
- GET /scanners/logs (recent scan activity)

Health
- GET /health
- GET /api/v1/health

---

## 🧰 Type Generation Commands

- Types only
```bash
npx openapi-typescript http://localhost:3000/api/v1/docs/openapi.json \
  -o ./src/types/api.ts
```

- Use exported file (no server required)
```bash
npm run docs:openapi
npx openapi-typescript ./openapi.json -o ./src/types/api.ts
```

- Full client (axios)
```bash
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3000/api/v1/docs/openapi.json \
  -g typescript-axios \
  -o ./src/api/generated
```

---

## 🧱 Suggested Dashboard Structure
```
src/
  api/
    client.ts        # Axios wrapper with interceptors
    auth.ts          # Auth endpoints (login/refresh/me)
    analytics.ts     # Dashboard analytics endpoints
    events.ts        # Event CRUD + stats
    orders.ts        # Order flows
    tickets.ts       # Ticket actions
    generated/       # (optional) OpenAPI-generated client
  components/
    Dashboard/
    Analytics/
    Events/
    Orders/
    Tickets/
  hooks/
    useAuth.ts
    useAnalytics.ts
    useEventsLive.ts
  types/
    api.ts           # Generated types from OpenAPI
  state/
    authStore.ts
  pages/
    Login.tsx
    Dashboard.tsx
    Events.tsx
```

---

## 🧪 Example Flows

Authentication
1) POST /auth/login → store accessToken + refreshToken
2) Set Authorization header for subsequent requests
3) On 401 → POST /auth/refresh → retry original request

Initial Data Load (Dashboard Home)
1) GET /analytics/dashboard
2) GET /events (first page)
3) GET /scanners/logs?limit=10

Event Details Page
1) GET /events/:id
2) Poll: /events/:id/occupancy (5s), /events/:id/stats (30s)

---

## 📄 OpenAPI for AI Agents
- Preferred input: the full JSON at /api/v1/docs/openapi.json
- Alternative: include the exported ./openapi.json
- AI should infer: endpoints, schemas, security, examples
- Don’t hardcode URLs; use base URL + paths from spec

---

## 🛡️ Notes & Constraints
- All protected endpoints require Bearer JWT
- Pagination and filters are supported on list endpoints
- Rate limit headers may apply (implement basic retry/backoff)
- Use ISO 8601 for date-time parameters

---

## 🧭 Where to Find More
- Swagger UI: http://localhost:3000/api/v1/docs
- OpenAPI JSON: http://localhost:3000/api/v1/docs/openapi.json
- Export spec: npm run docs:openapi → ./openapi.json
- Health: http://localhost:3000/health

---

## 📝 Example AI Prompt (Copy-Paste)

I need a React + TypeScript dashboard for the TixMo API.
Here is the OpenAPI spec (paste JSON or provide URL http://localhost:3000/api/v1/docs/openapi.json).

Requirements:
1. Auth pages (login) with JWT + refresh handling
2. Dashboard with sales summary and recent scans
3. Events list + event details with live occupancy
4. Orders list and details; ticket transfer action
5. React Query, Axios client with interceptors, shadcn/ui
6. TypeScript types generated from OpenAPI
7. Proper error/loading states and pagination

Produce:
- API client layer
- Hooks (useDashboard, useEvent, useScans)
- Auth context + protected routes
- Pages and components with basic layout
