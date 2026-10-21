BEGIN;
INSERT INTO organizations(id,name,slug,type,status,updated_at) VALUES('org-276','Synthetic 276','synthetic-276','PROMOTER','ACTIVE',now());
INSERT INTO users(id,email,password_hash,first_name,last_name,session_version,disabled_at,organization_id,updated_at) VALUES('user-276','synthetic-276@example.invalid','NOT_A_LOGIN_HASH','Synthetic','Restore',7,'2026-10-20','org-276',now());
INSERT INTO events(id,organization_id,name,slug,tags,timezone,updated_at) VALUES('event-276','org-276','Synthetic Restore','restore-276','{}','America/St_Johns',now());
INSERT INTO ticket_types(id,event_id,name,price,quantity_total,quantity_available,quantity_sold,quantity_held,updated_at) VALUES('type-276','event-276','Synthetic GA',25,10,7,2,1,now());
INSERT INTO orders(id,order_number,user_id,event_id,status,total_amount,payment_status,updated_at) VALUES('order-276','SYNTHETIC-276','user-276','event-276','PAID',50,'SUCCEEDED',now()),('held-order-276','SYNTHETIC-HOLD-276','user-276','event-276','PENDING',25,'PENDING',now());
INSERT INTO tickets(id,order_id,event_id,ticket_type_id,user_id,barcode,qr_code_url,inventory_state,status,price_paid,checked_in_at,updated_at) VALUES('ticket-276-a','order-276','event-276','type-276','user-276','SYNTHETIC276A','data:synthetic-qr-a','SOLD','VALID',25,NULL,now()),('ticket-276-b','order-276','event-276','type-276','user-276','SYNTHETIC276B','data:synthetic-qr-b','SOLD','USED',25,'2026-10-20',now()),('ticket-276-held','held-order-276','event-276','type-276','user-276','SYNTHETIC276H',NULL,'HELD','VALID',25,NULL,now());
INSERT INTO staff_invitations(id,user_id,issuer_id,token_hash,session_version,expires_at) VALUES('invite-276','user-276','user-276','SYNTHETIC_HASH_NOT_TOKEN',6,'2026-10-22');
COMMIT;
