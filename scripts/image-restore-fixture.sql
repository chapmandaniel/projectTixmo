-- Inert SQL-only synthetic fixture; no provider, authentication or scan admission claim.
BEGIN;
INSERT INTO organizations(id,name,slug,type,updated_at) VALUES('restore-org','Synthetic restore','restore-org','PROMOTER',now());
INSERT INTO users(id,email,password_hash,first_name,last_name,organization_id,role,disabled_at,session_version,updated_at)
VALUES('restore-buyer','restore-buyer@test.invalid','synthetic','Restore','Buyer','restore-org','CUSTOMER',now(),7,now());
INSERT INTO events(id,organization_id,name,slug,status,start_datetime,tags,sales_paused,updated_at)
VALUES('restore-event','restore-org','Synthetic restore','restore-event','ON_SALE',now()+interval '2 days',ARRAY[]::text[],true,now());
INSERT INTO ticket_types(id,event_id,name,price,quantity_total,quantity_available,quantity_sold,quantity_held,updated_at)
VALUES('restore-type','restore-event','GA',10,10,8,1,1,now());
INSERT INTO ticket_tiers(id,ticket_type_id,name,price,quantity_limit,quantity_sold,quantity_held,updated_at)
VALUES('restore-tier','restore-type','Regular',10,10,1,1,now());
INSERT INTO orders(id,order_number,user_id,event_id,total_amount,status,payment_status,payment_intent_id,currency,receipt_status,receipt_sent_at,updated_at)
VALUES('restore-paid','RESTORE-PAID','restore-buyer','restore-event',10,'PAID','SUCCEEDED','pi_restore_paid','cad','SENT',now(),now()),
('restore-pending','RESTORE-PENDING','restore-buyer','restore-event',10,'PENDING','PROCESSING','pi_restore_pending','cad','PENDING',NULL,now());
INSERT INTO tickets(id,order_id,event_id,ticket_type_id,tier_id,user_id,barcode,status,inventory_state,price_paid,checked_in_at,updated_at)
VALUES('restore-sold','restore-paid','restore-event','restore-type','restore-tier','restore-buyer','RESTORE-SOLD','USED','SOLD',10,now(),now()),
('restore-held','restore-pending','restore-event','restore-type','restore-tier','restore-buyer','RESTORE-HELD','VALID','HELD',10,NULL,now());
INSERT INTO payment_attempts(id,order_id,amount,currency,payment_intent_id,updated_at)
VALUES('restore-attempt','restore-pending',1000,'cad','pi_restore_pending',now());
INSERT INTO payment_webhook_events(id,type,payment_intent_id,order_id,status,attempt_generation,lease_token,attempts,processed_at,updated_at)
VALUES('evt_restore','payment_intent.succeeded','pi_restore_paid','restore-paid','PROCESSED',9007199254740993,'restore-generation-token',2,now(),now());
INSERT INTO event_sales_controls(id,event_id,organization_id,actor_id,request_id,reason,before_paused,after_paused)
VALUES('restore-audit','restore-event','restore-org','restore-buyer','restore-request','Synthetic staffing review',false,true);
COMMIT;
