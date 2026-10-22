DO $$ BEGIN
IF (SELECT count(*) FROM orders) <> 2 OR (SELECT count(*) FROM tickets) <> 2 THEN RAISE EXCEPTION 'Synthetic identities missing'; END IF;
IF NOT EXISTS(SELECT 1 FROM ticket_types WHERE id='restore-type' AND quantity_total=10 AND quantity_available=8 AND quantity_sold=1 AND quantity_held=1 AND quantity_total=quantity_available+quantity_sold+quantity_held) THEN RAISE EXCEPTION 'Inventory not conserved'; END IF;
IF NOT EXISTS(SELECT 1 FROM ticket_tiers WHERE id='restore-tier' AND quantity_sold=1 AND quantity_held=1) THEN RAISE EXCEPTION 'Tier counters changed'; END IF;
IF NOT EXISTS(SELECT 1 FROM tickets WHERE id='restore-sold' AND status='USED' AND inventory_state='SOLD' AND barcode='RESTORE-SOLD' AND tier_id='restore-tier' AND checked_in_at IS NOT NULL) THEN RAISE EXCEPTION 'Paid credential shape changed'; END IF;
IF NOT EXISTS(SELECT 1 FROM tickets WHERE id='restore-held' AND status='VALID' AND inventory_state='HELD' AND tier_id='restore-tier') THEN RAISE EXCEPTION 'Held allocation changed'; END IF;
IF NOT EXISTS(SELECT 1 FROM orders WHERE id='restore-paid' AND status='PAID' AND payment_status='SUCCEEDED' AND currency='cad' AND total_amount=10 AND receipt_status='SENT' AND receipt_sent_at IS NOT NULL) THEN RAISE EXCEPTION 'Receipt shape changed'; END IF;
IF NOT EXISTS(SELECT 1 FROM orders WHERE id='restore-pending' AND status='PENDING' AND payment_status='PROCESSING' AND receipt_sent_at IS NULL) THEN RAISE EXCEPTION 'Pending shape changed'; END IF;
IF NOT EXISTS(SELECT 1 FROM payment_attempts WHERE id='restore-attempt' AND order_id='restore-pending' AND amount=1000 AND currency='cad' AND payment_intent_id='pi_restore_pending') THEN RAISE EXCEPTION 'Attempt binding changed'; END IF;
IF NOT EXISTS(SELECT 1 FROM payment_webhook_events WHERE id='evt_restore' AND status='PROCESSED' AND attempt_generation=9007199254740993 AND lease_token='restore-generation-token' AND attempts=2 AND processed_at IS NOT NULL) THEN RAISE EXCEPTION 'Generation changed'; END IF;
IF NOT EXISTS(SELECT 1 FROM users WHERE id='restore-buyer' AND disabled_at IS NOT NULL AND session_version=7 AND NOT is_platform_admin) THEN RAISE EXCEPTION 'Revocation shape changed'; END IF;
IF NOT EXISTS(SELECT 1 FROM events WHERE id='restore-event' AND sales_paused) OR NOT EXISTS(SELECT 1 FROM event_sales_controls WHERE id='restore-audit' AND event_id='restore-event' AND actor_id='restore-buyer' AND reason='Synthetic staffing review' AND NOT before_paused AND after_paused) THEN RAISE EXCEPTION 'Audit changed'; END IF;
END $$;
