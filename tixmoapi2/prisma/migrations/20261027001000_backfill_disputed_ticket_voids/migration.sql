-- Cancel still-VALID tickets on disputed orders. Inventory columns stay as they are.
-- Audit rows match the dispute void path and are skipped when that path already wrote one.
INSERT INTO ticket_inventory_reconciliations (
    id,
    ticket_type_id,
    actor_id,
    evidence,
    snapshot_fingerprint,
    plan_fingerprint,
    before,
    after
)
SELECT
    gen_random_uuid()::text,
    snap.ticket_type_id,
    'stripe-dispute',
    'Payment disputed',
    md5(snap.before_doc::text),
    'ticket-void:DISPUTE_CREATED:' || o.id || ':' || o.id,
    snap.before_doc,
    snap.after_doc
FROM orders o
JOIN LATERAL (
    SELECT
        (array_agg(t.ticket_type_id ORDER BY t.id))[1] AS ticket_type_id,
        jsonb_build_object(
            'action', 'DISPUTE_CREATED',
            'orderId', o.id,
            'sourceId', o.id,
            'inventoryReleased', false,
            'reasonCode', 'VOID_DISPUTED',
            'tickets', jsonb_agg(
                jsonb_build_object(
                    'id', t.id,
                    'status', 'VALID',
                    'inventoryState', t.inventory_state::text
                )
                ORDER BY t.id
            )
        ) AS before_doc,
        jsonb_build_object(
            'action', 'DISPUTE_CREATED',
            'orderId', o.id,
            'sourceId', o.id,
            'inventoryReleased', false,
            'reasonCode', 'VOID_DISPUTED',
            'tickets', jsonb_agg(
                jsonb_build_object(
                    'id', t.id,
                    'status', 'CANCELLED',
                    'inventoryState', t.inventory_state::text
                )
                ORDER BY t.id
            )
        ) AS after_doc
    FROM tickets t
    WHERE t.order_id = o.id
      AND t.status = 'VALID'
    HAVING count(*) > 0
) snap ON true
WHERE (o.refund_status = 'DISPUTED' OR o.refund_status LIKE 'DISPUTE\_%' ESCAPE '\')
  AND NOT EXISTS (
      SELECT 1
      FROM ticket_inventory_reconciliations existing
      WHERE existing.plan_fingerprint = 'ticket-void:DISPUTE_CREATED:' || o.id || ':' || o.id
  );

UPDATE tickets AS t
SET status = 'CANCELLED',
    updated_at = CURRENT_TIMESTAMP
FROM orders AS o
WHERE t.order_id = o.id
  AND t.status = 'VALID'
  AND (o.refund_status = 'DISPUTED' OR o.refund_status LIKE 'DISPUTE\_%' ESCAPE '\');
