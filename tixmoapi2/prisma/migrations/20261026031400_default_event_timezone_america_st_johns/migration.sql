-- Default only. Existing event rows, including NULL timezones, are left unchanged.
ALTER TABLE "events" ALTER COLUMN "timezone" SET DEFAULT 'America/St_Johns';
