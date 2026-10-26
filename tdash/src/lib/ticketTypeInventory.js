function finiteCount(value) {
    if (value === '' || value === null || value === undefined) return null;
    const count = Number(value);
    return Number.isFinite(count) ? count : null;
}

function firstCount(ticket, fields) {
    for (const field of fields) {
        const count = finiteCount(ticket?.[field]);
        if (count !== null) return count;
    }
    return 0;
}

/** Sold count on a ticket type. The API field is quantitySold. */
export function ticketSoldCount(ticket) {
    return firstCount(ticket, ['quantitySold', 'sold']);
}

/** Capacity on a ticket type. The API field is quantityTotal. */
export function ticketTotalCount(ticket) {
    return firstCount(ticket, ['quantityTotal', 'quantity']);
}

export function ticketSoldPercent(ticket) {
    const total = ticketTotalCount(ticket);
    if (total <= 0) return 0;
    return Math.min(100, (ticketSoldCount(ticket) / total) * 100);
}

export function presentTicketType(ticket) {
    return {
        ...ticket,
        sold: ticketSoldCount(ticket),
        quantity: ticketTotalCount(ticket),
    };
}
