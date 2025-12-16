# Security Review
**Goal:** Assess security posture.

## Context & Approach
Review authentication, authorization, and validation mechanisms.

## Evidence
- [x] Auth Flow (JWT/Refresh): **Verified** (Routes and middleware exist)
- [x] RBAC Implementation: **Verified** (`authorize` middleware used on sensitive routes)
- [x] Input Validation (Zod): **Verified** (`validate` middleware used with schemas)

