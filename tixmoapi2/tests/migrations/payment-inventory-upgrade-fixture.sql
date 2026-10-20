-- Representative rows written by the pre-integrity schema/runtime.
INSERT INTO users (id, email, password_hash, first_name, last_name, updated_at)
VALUES ('upgrade-buyer', 'upgrade-buyer@test.invalid', 'synthetic', 'Upgrade', 'Buyer', now()),
       ('upgrade-recipient', 'upgrade-recipient@test.invalid', 'synthetic', 'Upgrade', 'Recipient', now());
INSERT INTO organizations (id, name, slug, type, updated_at)
VALUES ('upgrade-org', 'Upgrade fixture', 'upgrade-fixture', 'PROMOTER', now());
INSERT INTO events (id, organization_id, name, slug, status, start_datetime, end_datetime, updated_at)
VALUES ('upgrade-event', 'upgrade-org', 'Upgrade fixture', 'upgrade-fixture', 'PUBLISHED', now() + interval '2 days', now() + interval '3 days', now());
INSERT INTO ticket_types (id, event_id, name, price, quantity_total, quantity_available, quantity_sold, quantity_held, updated_at)
VALUES ('upgrade-known', 'upgrade-event', 'Known allocation', 10, 10, 7, 2, 1, now()),
       ('upgrade-ambiguous', 'upgrade-event', 'Ambiguous allocation', 10, 10, 9, 1, 0, now());
INSERT INTO ticket_tiers (id, ticket_type_id, name, price, quantity_limit, created_at, updated_at)
VALUES ('upgrade-tier', 'upgrade-known', 'Limited', 8, 3, now() - interval '2 days', now()),
       ('upgrade-tier-a', 'upgrade-ambiguous', 'One', 8, 5, now() - interval '2 days', now()),
       ('upgrade-tier-b', 'upgrade-ambiguous', 'Two', 8, 5, now() - interval '2 days', now());
INSERT INTO orders (id, order_number, user_id, event_id, total_amount, status, payment_status, payment_intent_id, updated_at)
VALUES ('upgrade-paid', 'UPGRADE-PAID', 'upgrade-buyer', 'upgrade-event', 16, 'PAID', 'SUCCEEDED', 'pi_upgrade_fixture', now()),
       ('upgrade-pending', 'UPGRADE-PENDING', 'upgrade-buyer', 'upgrade-event', 8, 'PENDING', 'PENDING', NULL, now()),
       ('upgrade-unclear', 'UPGRADE-UNCLEAR', 'upgrade-buyer', 'upgrade-event', 8, 'PAID', 'SUCCEEDED', NULL, now());
INSERT INTO tickets (id, order_id, event_id, ticket_type_id, user_id, barcode, qr_code_url, status, price_paid, transferred_from, transferred_at, updated_at)
VALUES ('upgrade-transferred', 'upgrade-paid', 'upgrade-event', 'upgrade-known', 'upgrade-recipient', 'PRE-UPGRADE-SENDER-CREDENTIAL', 'cached-old-qr', 'TRANSFERRED', 8, 'upgrade-buyer', now() - interval '1 hour', now()),
       ('upgrade-sold', 'upgrade-paid', 'upgrade-event', 'upgrade-known', 'upgrade-buyer', 'UPGRADE-SOLD', NULL, 'VALID', 8, NULL, NULL, now()),
       ('upgrade-held', 'upgrade-pending', 'upgrade-event', 'upgrade-known', 'upgrade-buyer', 'UPGRADE-HELD', NULL, 'VALID', 8, NULL, NULL, now()),
       ('upgrade-ambiguous-ticket', 'upgrade-unclear', 'upgrade-event', 'upgrade-ambiguous', 'upgrade-buyer', 'UPGRADE-AMBIGUOUS', NULL, 'VALID', 8, NULL, NULL, now());
