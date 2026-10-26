const cell = (value) => {
    let text = String(value ?? '');
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
};

export const guestName = (ticket) => [ticket?.user?.firstName, ticket?.user?.lastName].filter(Boolean).join(' ');

export function ticketMatches(ticket, query) {
    const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const haystack = [
        guestName(ticket),
        ticket?.user?.email,
        ticket?.ticketType?.name,
        ticket?.order?.orderNumber,
        ticket?.barcode,
        ticket?.status,
    ].filter((value) => typeof value === 'string').join(' ').toLowerCase();
    return terms.every((term) => haystack.includes(term));
}

export const attendeesToCsv = (tickets) => [
    ['Guest', 'Email', 'Ticket type', 'Status', 'Order', 'Barcode'],
    ...tickets.map((ticket) => [guestName(ticket), ticket?.user?.email, ticket?.ticketType?.name, ticket?.status, ticket?.order?.orderNumber, ticket?.barcode]),
].map((row) => row.map(cell).join(',')).join('\r\n');

export function unwrapTicketPage(response) {
    const body = response?.data?.data && !Array.isArray(response.data.data) ? response.data.data : (response?.data || {});
    return {
        tickets: Array.isArray(body.tickets) ? body.tickets : [],
        pagination: body.pagination || {},
    };
}
