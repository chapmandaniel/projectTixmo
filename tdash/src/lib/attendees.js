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
    if (refund && refund !== 'NONE') return titleCase(refund);
    if (orderStatus === 'REFUNDED') return 'Refunded';
    if (orderStatus === 'PARTIALLY_REFUNDED') return 'Partially refunded';
    if (orderStatus === 'CANCELLED') return 'Cancelled';
    return '';
}

const voidRefund = (refund) => refund === 'DISPUTED'
    || refund === 'DISPUTE'
    || refund.startsWith('DISPUTE_')
    || refund === 'VOID'
    || refund.startsWith('VOID_')
    || ['PROCESSING', 'SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED'].includes(refund);

export function canCheckIn(ticket) {
    const status = String(ticket?.status || '').trim().toUpperCase();
    if (status !== 'VALID' || status === 'CANCELLED' || status.startsWith('VOID')) return false;
    const orderStatus = String(ticket?.order?.status || '').trim().toUpperCase();
    if (['REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED'].includes(orderStatus)) return false;
    const refund = String(ticket?.order?.refundStatus || '').trim().toUpperCase();
    if (!refund || refund === 'NONE') return true;
    return !voidRefund(refund);
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
