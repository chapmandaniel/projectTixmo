-- Full row fingerprints preserve durable IDs, amounts, inventory, QR and auth shape.
SELECT format('SELECT %L, count(*), md5(coalesce(string_agg(row_to_json(t)::text, chr(10) ORDER BY row_to_json(t)::text),%L)) FROM %I t;', tablename, '', tablename) FROM pg_tables WHERE schemaname='public' ORDER BY tablename
\gexec
DO $$ BEGIN
IF (SELECT count(*) FROM tickets) <> 3 OR (SELECT count(*) FROM orders) <> 2 THEN RAISE EXCEPTION 'fixture counts'; END IF;
IF NOT EXISTS(SELECT 1 FROM ticket_types WHERE id='type-276' AND quantity_total=10 AND quantity_available=7 AND quantity_sold=2 AND quantity_held=1 AND quantity_total=quantity_available+quantity_sold+quantity_held) THEN RAISE EXCEPTION 'inventory'; END IF;
IF (SELECT count(*) FROM tickets WHERE inventory_state='SOLD') <> 2 OR (SELECT count(*) FROM tickets WHERE inventory_state='HELD') <> 1 THEN RAISE EXCEPTION 'ticket allocation'; END IF;
IF NOT EXISTS(SELECT 1 FROM tickets WHERE id='ticket-276-b' AND status='USED' AND checked_in_at IS NOT NULL AND qr_code_url='data:synthetic-qr-b') THEN RAISE EXCEPTION 'QR scan state'; END IF;
IF NOT EXISTS(SELECT 1 FROM users u JOIN staff_invitations i ON i.user_id=u.id WHERE u.id='user-276' AND u.disabled_at IS NOT NULL AND u.session_version=7 AND i.session_version=6 AND i.session_version<u.session_version AND u.password_hash='NOT_A_LOGIN_HASH') THEN RAISE EXCEPTION 'revocation data'; END IF;
IF EXISTS(SELECT 1 FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) THEN RAISE EXCEPTION 'migration ledger'; END IF;
END $$;
SELECT 'ACCEPTANCE_OK';
