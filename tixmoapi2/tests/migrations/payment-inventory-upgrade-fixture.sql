-- Inert synthetic fixture: valid only after the first 26 migrations.
-- No valid login hashes, provider identifiers, scanner keys or mail delivery.
BEGIN;
INSERT INTO organizations (id,name,slug,type,status,updated_at)
VALUES ('upgrade-org','Synthetic upgrade','synthetic-upgrade','PROMOTER','ACTIVE','2026-01-01');
INSERT INTO users (id,email,password_hash,first_name,last_name,role,organization_id,updated_at) VALUES
('upgrade-buyer','buyer@example.invalid','INERT-NOT-A-PASSWORD-HASH','Synthetic','Buyer','CUSTOMER',NULL,'2026-01-01'),
('upgrade-recipient','recipient@example.invalid','INERT-NOT-A-PASSWORD-HASH','Synthetic','Recipient','CUSTOMER',NULL,'2026-01-01'),
('upgrade-bootstrap','admin@tixmo.com','INERT-NOT-A-PASSWORD-HASH','Synthetic','Bootstrap','ADMIN',NULL,'2026-01-01'),
('upgrade-deleted','deleted_synthetic@deleted.com','INERT-NOT-A-PASSWORD-HASH','Synthetic','Deleted','ADMIN','upgrade-org','2026-01-01'),
('upgrade-unscoped','admin@example.invalid','INERT-NOT-A-PASSWORD-HASH','Synthetic','Unscoped','ADMIN',NULL,'2026-01-01');
INSERT INTO events (id,organization_id,name,slug,start_datetime,end_datetime,status,capacity,updated_at) VALUES
('upgrade-event','upgrade-org','Synthetic event','synthetic-event','2099-01-01','2099-01-02','ON_SALE',100,'2026-01-01'),
('upgrade-cancelled-event','upgrade-org','Cancelled event','synthetic-cancelled','2099-01-01','2099-01-02','CANCELLED',100,'2026-01-01');
INSERT INTO ticket_types (id,event_id,name,price,quantity_total,quantity_available,updated_at)
SELECT 'upgrade-'||label, CASE WHEN label='cancelled' THEN 'upgrade-cancelled-event' ELSE 'upgrade-event' END,
label,8,100,90,'2026-01-01'::timestamp FROM unnest(ARRAY['known','ambiguous','unmatched','inconsistent','cancelled']) AS label;
INSERT INTO ticket_tiers (id,ticket_type_id,name,price,quantity_limit,quantity_sold,created_at,updated_at) VALUES
('upgrade-tier','upgrade-known','Known',8,3,2,'2026-01-01','2026-01-01'),
('upgrade-ambiguous-a','upgrade-ambiguous','Overlap A',8,10,0,'2026-01-01','2026-01-01'),
('upgrade-ambiguous-b','upgrade-ambiguous','Overlap B',8,10,0,'2026-01-01','2026-01-01'),
('upgrade-unmatched-tier','upgrade-unmatched','Unmatched',9,10,0,'2026-01-01','2026-01-01'),
('upgrade-inconsistent-tier','upgrade-inconsistent','Inconsistent',8,10,5,'2026-01-01','2026-01-01'),
('upgrade-cancelled-tier','upgrade-cancelled','Cancelled',8,10,1,'2026-01-01','2026-01-01');
INSERT INTO orders (id,order_number,user_id,event_id,status,total_amount,payment_status,payment_intent_id,created_at,updated_at) VALUES
('upgrade-paid','SYNTHETIC-PAID','upgrade-buyer','upgrade-event','PAID',16,'SUCCEEDED','INERT-NOT-A-PROVIDER-INTENT','2026-06-01','2026-06-01'),
('upgrade-pending','SYNTHETIC-PENDING','upgrade-buyer','upgrade-event','PENDING',8,'PENDING',NULL,'2026-06-01','2026-06-01'),
('upgrade-history','SYNTHETIC-HISTORY','upgrade-buyer','upgrade-event','PAID',24,'SUCCEEDED',NULL,'2026-06-01','2026-06-01'),
('upgrade-cancelled-paid','SYNTHETIC-CANCELLED-PAID','upgrade-buyer','upgrade-cancelled-event','PAID',8,'SUCCEEDED',NULL,'2026-06-01','2026-06-01'),
('upgrade-cancelled-order','SYNTHETIC-CANCELLED','upgrade-buyer','upgrade-event','CANCELLED',8,'FAILED',NULL,'2026-06-01','2026-06-01');
INSERT INTO tickets (id,order_id,event_id,ticket_type_id,user_id,barcode,qr_code_url,status,price_paid,transferred_from,transferred_at,checked_in_at,checked_in_by,created_at,updated_at) VALUES
('upgrade-transferred','upgrade-paid','upgrade-event','upgrade-known','upgrade-recipient','PRE-UPGRADE-SENDER-CREDENTIAL','INERT-QR-CACHE','TRANSFERRED',8,'upgrade-buyer','2026-06-02',NULL,NULL,'2026-06-01','2026-06-02'),
('upgrade-used','upgrade-paid','upgrade-event','upgrade-known','upgrade-buyer','SYNTHETIC-USED',NULL,'USED',8,NULL,NULL,'2026-06-02','upgrade-buyer','2026-06-01','2026-06-02'),
('upgrade-held','upgrade-pending','upgrade-event','upgrade-known','upgrade-buyer','SYNTHETIC-HELD',NULL,'VALID',8,NULL,NULL,NULL,NULL,'2026-06-01','2026-06-01'),
('upgrade-ambiguous-ticket','upgrade-history','upgrade-event','upgrade-ambiguous','upgrade-buyer','SYNTHETIC-AMBIGUOUS',NULL,'VALID',8,NULL,NULL,NULL,NULL,'2026-06-01','2026-06-01'),
('upgrade-unmatched-ticket','upgrade-history','upgrade-event','upgrade-unmatched','upgrade-buyer','SYNTHETIC-UNMATCHED',NULL,'VALID',8,NULL,NULL,NULL,NULL,'2026-06-01','2026-06-01'),
('upgrade-inconsistent-ticket','upgrade-history','upgrade-event','upgrade-inconsistent','upgrade-buyer','SYNTHETIC-INCONSISTENT',NULL,'VALID',8,NULL,NULL,NULL,NULL,'2026-06-01','2026-06-01'),
('upgrade-cancelled-ticket','upgrade-cancelled-paid','upgrade-cancelled-event','upgrade-cancelled','upgrade-buyer','SYNTHETIC-CANCELLED',NULL,'CANCELLED',8,NULL,NULL,NULL,NULL,'2026-06-01','2026-06-01'),
('upgrade-released','upgrade-cancelled-order','upgrade-event','upgrade-known','upgrade-buyer','SYNTHETIC-RELEASED',NULL,'CANCELLED',8,NULL,NULL,NULL,NULL,'2026-06-01','2026-06-01');
INSERT INTO scanners (id,name,api_key,organization_id,event_id,created_by,updated_at)
VALUES ('upgrade-scanner','Synthetic scanner','INERT-NOT-A-SCANNER-KEY','upgrade-org','upgrade-event','upgrade-buyer','2026-06-01');
INSERT INTO scan_logs (id,scanner_id,ticket_id,event_id,scanned_at)
VALUES ('upgrade-scan','upgrade-scanner','upgrade-used','upgrade-event','2026-06-02');
INSERT INTO payment_webhook_events (id,type,payment_intent_id,order_id,status,error_message,processing_started_at,processed_at,created_at,updated_at)
SELECT 'upgrade-webhook-'||state,'synthetic.inert',NULL,'upgrade-paid',state,
CASE WHEN state='FAILED' THEN 'synthetic historical failure' END,'2026-06-01',
CASE WHEN state='PROCESSED' THEN '2026-06-02'::timestamp END,'2026-06-01','2026-06-02'
FROM unnest(ARRAY['PROCESSING','FAILED','PROCESSED']) AS state;
COMMIT;
