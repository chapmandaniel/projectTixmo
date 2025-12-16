# 📚 API Documentation Guide

## Quick Links

- Swagger UI: http://localhost:3000/api/v1/docs
- OpenAPI JSON (machine-readable): http://localhost:3000/api/v1/docs/openapi.json
- API Base URL: http://localhost:3000/api/v1
- Health Check: http://localhost:3000/health

## For AI and Tooling

Provide AI agents the complete OpenAPI JSON so they can infer endpoints, schemas, security, and examples.

- Direct URL (when server is running):
  - http://localhost:3000/api/v1/docs/openapi.json

- Export to file (no server required):
  - npm run docs:openapi
  - Output: ./openapi.json

- Curl example:
  - curl -sS http://localhost:3000/api/v1/docs/openapi.json -o openapi.json

- What’s inside: openapi, info, servers, tags, components.schemas (User, Error, …), and all paths scanned from ./src/api/**/*.ts via swagger-jsdoc.

Tip: Some AIs accept either a URL or the JSON content pasted directly.

## How to View Swagger Documentation

1) Start the Server

```bash
npm run dev
```

2) Open Swagger UI

```bash
open http://localhost:3000/api/v1/docs
```

3) Authorize (JWT)
- Register → Login → Copy accessToken → Click Authorize → Enter: `Bearer <token>`

## Schemas and Structure Overview

- OpenAPI version: 3.0.0
- Security: bearerAuth (JWT)
- Servers:
  - http://localhost:3000/api/v1 (development)
  - https://api.tixmo.com/v1 (production - planned)
- Tags: Authentication, Users, Organizations, Venues, Events, Ticket Types, Orders, Tickets, Promo Codes, Scanners, Notifications, Analytics, Health
- Components.schemas (excerpt):
  - User: id, email, firstName, lastName, phone, role, organizationId, emailVerified, createdAt, updatedAt
  - Error: success, message, statusCode, errors

All additional schemas and request/response shapes are auto-generated from JSDoc annotations in route files under ./src/api/**.

## Endpoint Summary (high-level)

- Authentication: register, login, refresh, me, logout
- Users: CRUD and list (with roles)
- Organizations: CRUD, list, member management
- Venues: CRUD, list
- Events: CRUD, list/search, publish, cancel
- Ticket Types: CRUD, list, availability
- Orders: create, get, confirm, cancel, list
- Tickets: list, filter, transfer, cancel
- Promo Codes: CRUD, list, validate
- Scanners: devices and scans
- Notifications: preferences and email flows
- Analytics: reporting and metrics
- Health: health checks

For exact field requirements and response examples, see Swagger UI or inspect openapi.json.

## Postman and Others

- Import openapi.json into Postman/Insomnia to generate a collection automatically.

## Troubleshooting

- Server not starting? Check /health, logs, and ports 3000/5432/6379.
- Swagger not loading? Ensure server is running and that /api/v1/docs and /api/v1/docs/openapi.json are reachable.

---

Last Updated: November 13, 2025
API Version: v1
