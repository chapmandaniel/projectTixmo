'use strict';

// One upcoming rule, shared by the reconcile CLI and the runbook SQL:
// coalesce(end, start) > now. A missing end uses the start. A no-end event
// whose start is already past is not upcoming. No start and no end is not upcoming.
const UPCOMING_SQL = 'COALESCE(end_datetime, start_datetime) > now()';
const ENDED_SQL = 'COALESCE(end_datetime, start_datetime) <= now()';

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
