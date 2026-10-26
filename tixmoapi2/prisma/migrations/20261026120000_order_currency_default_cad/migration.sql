-- Default only. Existing orders, including historical usd rows, are not rewritten.
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'cad';
