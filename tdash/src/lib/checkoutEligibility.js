// Advisory browser display only: POST /orders rechecks server time and inventory.
const inside = (now, start, end) => (!start || now >= Date.parse(start))
    && (!end || now < Date.parse(end));

export const checkoutTicketState = (event, ticket, now) => {
    const tier = ticket.tiers?.find((candidate) => candidate.isActive
        && inside(now, candidate.startsAt, candidate.endsAt)
        && (candidate.quantityLimit == null
            || candidate.quantitySold + candidate.quantityHeld < candidate.quantityLimit));
    const eligible = ['PUBLISHED', 'ON_SALE'].includes(event?.status) && !event?.deletedAt
        && !event.salesPaused
        && (!event.startDatetime || now < Date.parse(event.startDatetime))
        && inside(now, event.salesStart, event.salesEnd)
        && ticket.status === 'ACTIVE' && ticket.tierInventoryStatus === 'READY'
        && inside(now, ticket.salesStart, ticket.salesEnd)
        && (!(ticket.hasConfiguredTiers || ticket.tiers?.length) || Boolean(tier));
    const tierRemaining = tier?.quantityLimit == null ? Infinity
        : Math.max(0, tier.quantityLimit - tier.quantitySold - tier.quantityHeld);
    return {
        price: Number(tier?.price ?? ticket.price ?? 0),
        max: eligible ? Math.max(0, Math.min(ticket.maxPerOrder ?? 10, ticket.quantityAvailable ?? 0, tierRemaining)) : 0,
    };
};

export const checkoutBoundaryDelay = (event, now) => {
    const boundaries = [event?.salesStart, event?.salesEnd, event?.startDatetime];
    for (const ticket of event?.ticketTypes || []) {
        boundaries.push(ticket.salesStart, ticket.salesEnd);
        for (const tier of ticket.tiers || []) boundaries.push(tier.startsAt, tier.endsAt);
    }
    // The periodic ceiling also notices clock changes; focus handles suspended tabs.
    return Math.max(1, Math.min(30000, ...boundaries.map(Date.parse).filter((time) => time > now).map((time) => time - now)));
};
