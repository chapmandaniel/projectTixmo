const cell = (value) => {
    let text = String(value ?? '');
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
};

export const guestName = (ticket) => [ticket?.user?.firstName, ticket?.user?.lastName].filter(Boolean).join(' ');

const titleCase = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function ticketStatusLabel(status) {
    const key = String(status || '').trim().toUpperCase();
    if (key === 'VALID') return 'Confirmed';
    if (key === 'USED') return 'Checked In';
    if (key === 'CANCELLED') return 'Cancelled';
    if (key === 'TRANSFERRED') return 'Transferred';
    if (key === 'VOID') return 'Void';
    if (key.startsWith('VOID_')) return `Void ${titleCase(key.slice(5))}`;
    return key ? titleCase(key) : '';
}

export function orderStateLabel(ticket) {
    const refund = String(ticket?.order?.refundStatus || '').trim().toUpperCase();
    const orderStatus = String(ticket?.order?.status || '').trim().toUpperCase();
    if (refund === 'DISPUTED' || refund === 'DISPUTE') return 'Disputed';
    if (refund.startsWith('DISPUTE_')) {
        const detail = titleCase(refund.slice('DISPUTE_'.length));
        return detail ? `Dispute ${detail}` : 'Disputed';
    }
    if (refund === 'VOID' || refund.startsWith('VOID_')) return ticketStatusLabel(refund);
    if (refund === 'PROCESSING') return 'Refund in progress';
    if (refund === 'SUCCEEDED' || refund === 'REFUNDED') return 'Refunded';
    if (refund === 'PARTIALLY_REFUNDED') return 'Partially refunded';
    if (refund === 'FAILED') return 'Refund failed';
    if (refund && refund !== 'NONE') return titleCase(refund);
    if (orderStatus === 'REFUNDED') return 'Refunded';
    if (orderStatus === 'PARTIALLY_REFUNDED') return 'Partially refunded';
    if (orderStatus === 'CANCELLED') return 'Cancelled';
    return '';
}

const DOORS_BEFORE_START_MS = 2 * 60 * 60 * 1000;
const ADMIT_EVENT_STATUSES = new Set(['PUBLISHED', 'ON_SALE', 'SOLD_OUT']);
const upper = (value) => String(value ?? '').trim().toUpperCase();

// Mirrors ticketFailure(..., entry: true, enforceTime: true) in
// tixmoapi2/src/services/ticket-admission.service.ts. Check In is shown only
// when that rule would admit the ticket.
export function canCheckIn(ticket, pageEvent, now = Date.now()) {
    const event = { ...(pageEvent || {}), ...(ticket?.event || {}) };
    const status = upper(ticket?.status);
    const refund = upper(ticket?.order?.refundStatus);
    const orderStatus = upper(ticket?.order?.status);
    if (refund === 'DISPUTED' || refund.startsWith('DISPUTE_') || status === 'VOID') return false;
    if (status === 'CANCELLED' || status === 'USED' || status !== 'VALID') return false;
    if (orderStatus !== 'PAID' || refund === 'PROCESSING') return false;
    if (event.deletedAt || !ADMIT_EVENT_STATUSES.has(upper(event.status))) return false;
    const start = event.startDatetime ? new Date(event.startDatetime).getTime() : NaN;
    if (Number.isFinite(start) && now < start - DOORS_BEFORE_START_MS) return false;
    const end = event.endDatetime ? new Date(event.endDatetime).getTime() : NaN;
    if (Number.isFinite(end) && now > end) return false;
    return true;
}

export function attendeeStatusBadges(ticket, pageEvent, now = Date.now()) {
    const admitted = canCheckIn(ticket, pageEvent, now);
    const statusLabel = upper(ticket?.status) === 'USED'
        ? 'Checked In'
        : upper(ticket?.status) === 'VALID' && admitted
            ? 'Confirmed'
            : ticketStatusLabel(ticket?.status);
    // A failed refund still leaves the ticket's own status. Drop only Confirmed,
    // which adds nothing once the refund failure is shown.
    if (upper(ticket?.order?.refundStatus) === 'FAILED') {
        return [statusLabel !== 'Confirmed' ? statusLabel : '', orderStateLabel(ticket)].filter(Boolean);
    }
    const orderLabel = orderStateLabel(ticket);
    return orderLabel && orderLabel !== statusLabel ? [statusLabel, orderLabel] : [statusLabel].filter(Boolean);
}

export function ticketMatches(ticket, query) {
    const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const haystack = [
        guestName(ticket),
        ticket?.user?.email,
        ticket?.ticketType?.name,
        ticket?.order?.orderNumber,
        ticket?.barcode,
        ticketStatusLabel(ticket?.status),
        orderStateLabel(ticket),
    ].filter((value) => typeof value === 'string').join(' ').toLowerCase();
    return terms.every((term) => haystack.includes(term));
}

export const attendeesToCsv = (tickets) => [
    ['Guest', 'Email', 'Ticket type', 'Status', 'Order state', 'Order'],
    ...tickets.map((ticket) => [
        guestName(ticket),
        ticket?.user?.email,
        ticket?.ticketType?.name,
        ticketStatusLabel(ticket?.status),
        orderStateLabel(ticket),
        ticket?.order?.orderNumber,
    ]),
].map((row) => row.map(cell).join(',')).join('\r\n');

export function unwrapTicketPage(response) {
    const body = response?.data?.data && !Array.isArray(response.data.data) ? response.data.data : (response?.data || {});
    return {
        tickets: Array.isArray(body.tickets) ? body.tickets : [],
        pagination: body.pagination || {},
    };
}
