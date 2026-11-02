-- Additive checker-token scopes. Existing tokens keep ingest writes only.
-- targets:read is not granted unless a later issue sets it explicitly.

ALTER TABLE "giveaway_checker_tokens"
ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY['ingest:write']::TEXT[];
