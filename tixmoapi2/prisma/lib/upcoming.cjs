'use strict';

// One upcoming rule, shared by the reconcile CLI and the runbook SQL:
// coalesce(end, start) > UTC now. A missing end uses the start. A no-end event
// whose start is already past is not upcoming. No start and no end is not upcoming.
// Prisma DateTime without @db.Timestamptz is stored as timestamp without time
// zone in UTC clock time. now() follows the session TimeZone, so a non-UTC
// database would treat a just-ended event as still upcoming.
const UPCOMING_SQL =
  "COALESCE(end_datetime, start_datetime) > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')";
const ENDED_SQL =
  "COALESCE(end_datetime, start_datetime) <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')";

function boundary(event) {
  if (!event) return null;
  const end = event.endDatetime ?? event.end_datetime ?? null;
  const start = event.startDatetime ?? event.start_datetime ?? null;
  return end || start || null;
}

function isUpcoming(event, now) {
  const value = boundary(event);
  if (!value) return false;
  return new Date(value).getTime() > new Date(now).getTime();
}

module.exports = { boundary, isUpcoming, UPCOMING_SQL, ENDED_SQL };
