INSERT INTO payment_webhook_events (id,type,payment_intent_id,order_id,status,error_message,processing_started_at,processed_at,created_at,updated_at) VALUES
('qa170_processing','payment_intent.succeeded','pi_processing',NULL,'PROCESSING',NULL,'2024-01-02 03:04:05.123',NULL,'2023-02-03 04:05:06.234','2024-02-03 04:05:06.345'),
('qa170_failed','payment_intent.payment_failed','pi_failed','order_failed','FAILED','retained legacy error','2024-03-04 05:06:07.456','2024-03-04 05:07:08.567','2023-03-04 05:06:07.678','2024-03-04 05:07:08.789'),
('qa170_processed','payment_intent.succeeded',NULL,'order_processed','PROCESSED',NULL,'2024-04-05 06:07:08.890','2024-04-05 06:08:09.901','2023-04-05 06:07:08.012','2024-04-05 06:08:09.123');
CREATE TEMP TABLE legacy_snapshot AS SELECT * FROM payment_webhook_events;
SELECT 'BEFORE', row_to_json(e) FROM payment_webhook_events e ORDER BY id;
\i tixmoapi2/prisma/migrations/20261020120000_add_webhook_attempt_generation/migration.sql
SELECT 'AFTER', row_to_json(e) FROM payment_webhook_events e ORDER BY id;
DO $$ BEGIN
 IF (SELECT count(*) FROM payment_webhook_events) <> 3 THEN RAISE EXCEPTION 'row count changed'; END IF;
 IF EXISTS(SELECT 1 FROM payment_webhook_events e FULL JOIN legacy_snapshot l USING(id) WHERE (to_jsonb(e)-'attempt_generation') IS DISTINCT FROM to_jsonb(l)) THEN RAISE EXCEPTION 'legacy values changed'; END IF;
 IF EXISTS(SELECT 1 FROM payment_webhook_events WHERE attempt_generation IS DISTINCT FROM 0::bigint) THEN RAISE EXCEPTION 'default not zero'; END IF;
END $$;
SELECT 'UPGRADE_PRESERVED_ALL_VALUES_DEFAULT_ZERO', count(*) FROM payment_webhook_events;
