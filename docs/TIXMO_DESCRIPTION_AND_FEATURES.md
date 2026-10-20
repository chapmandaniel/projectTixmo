# Tixmo Description And Feature Overview

Tixmo is a live event ticketing and operations platform for promoters, venues, and event teams that need to launch events, sell tickets, manage field operations, and coordinate creative review from one workspace.

The product is built around the full event lifecycle: set up the organization, create venues and events, configure ticket inventory, publish checkout, process payments, manage orders and attendees, validate tickets at the door, review event assets, and monitor performance. The V1 experience focuses on the core operator workflow for real events, while broader marketing, resale, social, AI, and advanced traffic analytics features remain outside the launch path until the core sales and entry flow is stable.

## Product Positioning

Tixmo gives event operators a command center for high-energy live experiences. It combines a customer-facing checkout with an internal dashboard that handles the practical work behind an event: inventory, payments, attendees, scanners, creative approvals, shared assets, team access, notifications, and launch readiness.

The platform is designed for:

- Event promoters who need to create events, sell tickets, and track sales.
- Venue managers who need capacity, venue, attendee, and entry visibility.
- Operations teams that need role-based access, tasks, scanner setup, and support workflows.
- Creative and marketing teams that need approval requests, asset libraries, and external share links.
- Beta launch teams that need evidence-backed readiness gates before opening sales or doors.

## Core Value Proposition

Tixmo replaces scattered event tools with one controlled workflow. A team can move from event setup to public checkout, paid orders, attendee visibility, scanner validation, and post-launch reporting without manually stitching together disconnected spreadsheets, file shares, payment records, and entry logs.

The platform emphasizes:

- Controlled ticket inventory and order state.
- Secure, paid-order ticket issuance.
- Public checkout with Stripe payment support.
- Event-specific command centers for operations.
- Scanner authentication, online scanning, offline sync, and scan logs.
- External review and shared asset workflows.
- Organization-level access control and support readiness.
- Market-readiness evidence for launch decisions.

## Main Product Areas

### 1. Dashboard Workspace

The Tixmo dashboard is the operator home base. It includes modules for Event Manager, Tasks, Team, Assets, Review Portal, Analytics, Settings, Scanners, Orders, and event-level command centers.

Key capabilities include:

- A personalized dashboard home with configurable module tiles.
- Top-level navigation for events, tasks, team, assets, approvals, analytics, and settings.
- Notifications for dashboard activity.
- Dark and light dashboard themes.
- Protected authenticated routes for internal operator work.
- Public routes for checkout, external review links, and shared asset folders.
- Dedicated launch-path boundaries that keep post-V1 modules hidden or clearly labelled outside beta scope.

### 2. Organization And Team Management

Tixmo is organized around event operators and their organizations. Users belong to organizations, and access is controlled through role-based permissions.

Feature set:

- Organization creation and profile management.
- Multi-user team membership.
- Role assignment for owners, admins, managers, promoters, team members, scanners, and customers.
- Conservative access patterns for launch workflows.
- Organization-scoped access controls so teams only interact with the resources they are allowed to manage.
- Support for onboarding a beta organizer from account setup through launch readiness.

### 3. Venue Management

Venues can be created and attached to events so operators can manage event location, capacity, and operational context in one place.

Feature set:

- Venue creation, editing, listing, and deletion.
- Venue address and capacity details.
- Organization-linked venue ownership.
- Support for event association and venue-based event setup.
- Foundation for seating charts and more advanced venue configuration.

### 4. Event Management

Event Manager lets operators create, update, publish, cancel, and monitor events. Each event can open into an Event Command Center for deeper operational work.

Feature set:

- Event creation and editing.
- Event status workflow, including draft, published, on-sale, sold-out, completed, and cancelled style states.
- Event name, description, images, venue, timezone, dates, capacity, and metadata.
- Search and filtering for event lists.
- Event publish and cancel actions.
- Public checkout link generation for published or on-sale events.
- Event-specific command center with overview, orders, attendees, tickets, and settings.

### 5. Event Command Center

The Event Command Center is the event-level operations surface. It gives each event its own focused workspace rather than forcing teams to manage everything from global lists.

Feature set:

- Event identity header with status, date, venue, and checkout actions.
- Copy and open checkout link controls once the event is public.
- Event overview with sales, revenue, ticket, conversion, and activity summaries.
- Orders view for purchase and payment records.
- Attendees view for guest visibility.
- Tickets view for issued ticket management.
- Settings view for event configuration.
- Event-scoped navigation for fast operator movement during launch and live operations.

### 6. Ticket Types, Tiers, And Inventory

Tixmo supports structured ticket products with inventory controls so operators can sell multiple kinds of access without losing track of availability.

Feature set:

- Ticket type creation, editing, listing, and deletion.
- General admission, VIP, and other named ticket categories.
- Ticket tiers with price and availability controls.
- Quantity tracking for total, available, sold, and held inventory.
- Sales window controls.
- Maximum-per-order limits.
- Real-time availability checks.
- Inventory holds during checkout.
- Inventory release when orders expire or are cancelled.
- Oversell protection through transaction-backed order and ticket workflows.

### 7. Checkout And Payments

Tixmo includes a public checkout route for customers to select tickets, authenticate or register, agree to policies, and pay.

Feature set:

- Public event checkout pages at event-specific checkout URLs.
- Ticket quantity selection.
- Buyer registration and login during checkout.
- Order creation from selected ticket types.
- Stripe Payment Element integration.
- Payment intent creation and confirmation flow.
- Stripe webhook support for paid order confirmation.
- Runtime-configured payment currency and publishable key.
- Required Terms of Service, Privacy Policy, and Refund Policy links before payment.
- Customer account attachment for tickets and receipts.
- Guardrails to block launch when payment or policy runtime config is missing.

### 8. Orders And Attendees

Orders connect checkout activity to event operations. Paid orders become the trusted source for issued tickets and attendee records.

Feature set:

- Order creation and lookup.
- Order status tracking, including pending, paid, cancelled, refunded, and partial-refund style states.
- Payment intent and webhook event tracking.
- Order expiration for unpaid holds.
- Paid-order confirmation that generates tickets.
- Dashboard order visibility for operators.
- Attendee visibility tied to paid ticket purchases.
- Customer email notification support for order and payment outcomes.
- Safety against duplicate paid-order confirmation.

### 9. Ticket Lifecycle And Wallet Functions

Tickets are digital records attached to users, events, orders, and ticket types. They support post-purchase handling and entry validation.

Feature set:

- Ticket listing for customers and operators.
- Ticket detail lookup.
- Ticket transfer between users.
- Ticket cancellation.
- QR code generation for valid paid tickets.
- QR regeneration.
- Barcode and QR validation.
- Event check-in support.
- Status tracking for valid, used, cancelled, transferred, refunded, and expired states.
- Enforcement that ticket use is backed by paid orders.

### 10. Scanner And Door Operations

Tixmo supports field operations through scanner registration, scanner API keys, online scans, offline sync, offline batch upload, and scan logs.

Feature set:

- Scanner registration by owner, admin, manager, or promoter roles.
- Scanner API key authentication.
- Device naming and optional device identifiers.
- Active, disabled, and revoked scanner states.
- Online ticket scan endpoint.
- Offline ticket sync for valid and used tickets by event.
- Offline scan batch upload after connectivity returns.
- Scan logs with success or denial results.
- Scanner revocation for lost or compromised devices.
- Field-test workflow for valid, duplicate, wrong-event, cancelled, invalid, and offline scans.

### 11. Promo Codes And Discounts

Promo codes let operators run controlled ticket discounts.

Feature set:

- Promo code creation, listing, editing, and deletion.
- Percentage and fixed-amount discounts.
- Code validation and discount calculation.
- Usage tracking.
- Date range restrictions.
- Maximum usage protections.
- Organization-scoped promo code access.

### 12. Waitlists

Tixmo includes a waitlist API surface for demand capture and event follow-up.

Feature set:

- Waitlist entries tied to events and customers.
- Operational support for launch or sold-out flows.
- API-level integration point for future customer-facing waitlist experiences.

### 13. Notifications

Notifications support both operator awareness and customer communication.

Feature set:

- Dashboard notification list.
- Unread indicators.
- Mark-as-read and read-all behavior.
- Notification preferences.
- Welcome email support.
- Order confirmation emails.
- Ticket transfer notifications.
- Approval request, revision, reminder, decision, and comment emails.
- Provider-backed production configuration through Postmark or SMTP.

### 14. Analytics And Reporting

Analytics gives operators visibility into sales and event performance. V1 focuses on core event and sales reporting, while broader external traffic analytics remains outside the launch path.

Feature set:

- Dashboard analytics summary.
- Sales analytics by date range.
- Revenue tracking by day and event.
- Event performance metrics.
- Customer insights, including new versus repeat customers.
- Top customer and top event summaries.
- Reports endpoints for revenue, ticket sales, order counts, event performance, and dashboard stats.
- Event-level overview cards for revenue, tickets sold, page views, conversion, and sales velocity.

### 15. Tasks And Operational Follow-Through

The dashboard includes task management so event teams can track launch and operational work.

Feature set:

- Task creation and tracking.
- Assignment-oriented operational workflows.
- Task comments.
- Operator follow-through for launch readiness, support, and internal execution.
- Demo data support for repeatable market walkthroughs.

### 16. Creative Approvals

The Review Portal handles creative review workflows for event assets. It supports internal operators and external reviewers without forcing reviewers into the full dashboard.

Feature set:

- Approval request creation.
- Event-linked approval submissions.
- File upload for approval assets.
- Reviewer invitations by email.
- Reviewer association labels such as artist, agent, management, or other.
- External review routes for logged-out/private-browser access.
- Reviewer comments and decisions.
- Revision tracking.
- Approval status tracking.
- Pending approval badge counts in the dashboard.
- Promotion of approved images into the asset library.
- Approval archiving and deletion controls for authorized users.

### 17. Asset Library And Sharing

The Asset Library organizes brand and event files so teams can manage creative assets without losing track of versions and handoffs.

Feature set:

- Direct asset upload.
- Brand and event asset collections.
- Folder organization.
- Image, video, document, PDF, EPS, and other file handling.
- Search, filtering, sorting, grid view, and list view.
- Asset preview and deletion.
- Moving assets into folders.
- Shared folder links for external recipients.
- Share expiry windows.
- Share revocation.
- Public shared-folder routes that work without dashboard authentication.
- Signed asset URL support for short-lived access.

### 18. Public And External Routes

Tixmo includes public routes for buyers, reviewers, and asset recipients while keeping the operator dashboard protected.

Feature set:

- `/checkout/<event-slug>` for customer ticket purchase.
- External approval review routes.
- Shared asset folder routes.
- Runtime configuration for dashboard/API URLs, Stripe keys, policy links, and payment currency.
- Public-route launch evidence screenshots for checkout, review, and shared asset experiences.

### 19. Security, Reliability, And Launch Readiness

Tixmo includes infrastructure and launch-readiness practices for operating real events.

Feature set:

- JWT authentication with access and refresh tokens.
- Password hashing.
- Role-based authorization.
- Organization and tenant scoping.
- Scanner-specific authentication.
- Rate limiting for API usage.
- CORS trusted-origin controls.
- Sentry/error monitoring hooks.
- PostgreSQL persistence.
- Redis support for cache, rate limiting, and surge-sensitive workflows.
- Prisma migrations.
- Swagger/OpenAPI documentation.
- Health checks.
- Market readiness verification commands.
- Checkout runtime configuration evidence.
- Public route screenshot evidence.
- External smoke evidence workflows.
- Backup, migration, rollback, support, policy, and onboarding docs.

## V1 Launch Scope

The V1 launch path is intentionally focused on the core operator workflow:

- Organization account setup.
- Team and role access.
- Venue setup.
- Event setup.
- Ticket type and tier configuration.
- Public checkout.
- Stripe payment and webhook confirmation.
- Orders and attendees.
- Scanner validation.
- Creative approvals.
- Asset sharing.
- Core analytics and reports.
- Production readiness evidence.

The following are treated as post-V1, hidden, or outside the launch message unless explicitly re-scoped:

- Social hub.
- ProMo and broad creative automation claims.
- QuantMo.
- Marketing Hub.
- Resale and secondary-market workflows.
- Broad AI claims.
- GA4 Data API live traffic analytics beyond readiness/configuration.
- Advanced marketplace and affiliate features.

## Example End-To-End Workflow

1. An organizer signs in to the dashboard.
2. The organizer confirms their organization and team access.
3. The team creates a venue with capacity and location details.
4. The team creates an event with name, date, description, image, venue, timezone, and launch status.
5. The team creates ticket types, prices, inventory, tiers, and sales windows.
6. The event is published or moved on sale.
7. The Event Command Center exposes the checkout link.
8. A customer opens checkout, selects tickets, registers or signs in, accepts policies, and pays through Stripe.
9. The payment webhook marks the order paid and tickets are issued.
10. Operators see the order and attendee records in the dashboard.
11. Event staff register scanners and sync tickets before doors.
12. Scanners validate tickets at entry and write scan logs.
13. Creative teams use approvals and asset shares to coordinate event materials.
14. Operators review sales, attendees, scanner activity, and readiness evidence.

## Short Marketing Description

Tixmo is a premium event ticketing and operations platform for promoters, venues, and live-event teams. It brings event setup, public checkout, payments, ticket inventory, attendee management, scanner validation, creative approvals, asset sharing, and sales analytics into one polished command center built for real launch conditions.

## One-Line Description

Tixmo is the event command center for selling tickets, running doors, coordinating teams, and launching live experiences with confidence.
