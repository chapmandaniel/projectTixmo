// Fictional, development-only fixtures. No backend festival or pass is created.
const hall = {
    id: 'signal-hall',
    name: 'Signal Hall',
    address: {
        line1: '123 Water Street',
        city: 'St. John’s',
        province: 'NL',
        country: 'Canada',
    },
};
const studio = {
    id: 'harbour-studio',
    name: 'Harbour Studio',
    address: {
        line1: '45 Harbour Drive',
        city: 'St. John’s',
        province: 'NL',
        country: 'Canada',
    },
};
const rooftop = {
    id: 'rooftop',
    name: 'The Rooftop',
    address: {
        line1: '8 Duckworth Street',
        city: 'St. John’s',
        province: 'NL',
        country: 'Canada',
    },
};
const organization = { name: 'Signal Events' };
const ticket = (id, price, available = 120) => ({
    id: `${id}-ga`,
    name: 'General admission',
    description: 'Entry to this event only · standing',
    price: String(price),
    status: 'ACTIVE',
    quantityAvailable: available,
    maxPerOrder: 6,
});
const event = (
    id,
    name,
    start,
    end,
    venue,
    price,
    description,
    extra = {},
) => ({
    id,
    slug: id,
    name,
    startDatetime: start,
    endDatetime: end,
    venue,
    organization,
    category: 'Live music',
    timezone: 'America/St_Johns',
    status: 'ON_SALE',
    images: { main: '/images/event-onsale-preview.jpg' },
    description,
    ticketTypes: [ticket(id, price)],
    ...extra,
});

export const festivalPreview = {
    id: 'signal-weekender',
    slug: 'signal-weekender',
    name: 'Signal Weekender',
    description:
        'Three days of live music across St. John’s. Explore the program, choose your events, and find the pass that fits your weekend.',
    city: 'St. John’s',
    timezone: 'America/St_Johns',
    organization,
    dateLabel: 'November 19–21, 2027',
    images: { main: '/images/event-onsale-preview.jpg' },
    passesEnabled: true,
    events: [
        event(
            'opening-night',
            'Opening Night',
            '2027-11-19T22:30:00Z',
            '2027-11-20T02:00:00Z',
            hall,
            30,
            'The opening night of Signal Weekender, with live sets at Signal Hall.',
        ),
        event(
            'after-dark',
            'After Dark',
            '2027-11-20T02:30:00Z',
            '2027-11-20T05:30:00Z',
            studio,
            25,
            'Late-night electronic selections at Harbour Studio. This event starts on Friday night and ends early Saturday.',
        ),
        event(
            'afternoon-sessions',
            'Afternoon Sessions',
            '2027-11-20T17:30:00Z',
            '2027-11-20T20:30:00Z',
            studio,
            25,
            'An afternoon of live music at Harbour Studio.',
        ),
        event(
            'rooftop-sessions',
            'Rooftop Sessions',
            '2027-11-20T21:30:00Z',
            '2027-11-20T23:00:00Z',
            rooftop,
            40,
            'An intimate early-evening performance at The Rooftop. This separately ticketed event is not included in any festival pass.',
            {
                status: 'SOLD_OUT',
                ticketTypes: [ticket('rooftop-sessions', 40, 0)],
            },
        ),
        event(
            'neon-nights-preview',
            'Neon Nights',
            '2027-11-20T23:30:00Z',
            '2027-11-21T05:30:00Z',
            hall,
            35,
            'A night for the dance floor. Deep house, late-night selections, and a room full of people here for the music.\n\nJoin us at Signal Hall for an evening of electronic music, from the first warm-up set to the final track.',
            {
                category: 'Electronic',
                ticketTypes: [
                    {
                        ...ticket('preview-early', 25, 0),
                        name: 'Early entry',
                        description: 'General admission · first release',
                        sortOrder: 0,
                    },
                    { ...ticket('preview-ga', 35), sortOrder: 1 },
                    {
                        ...ticket('preview-vip', 55, 24),
                        name: 'Balcony access',
                        description: 'Event entry + upper-level viewing',
                        maxPerOrder: 4,
                        sortOrder: 2,
                    },
                ],
            },
        ),
        event(
            'sunday-closing',
            'Sunday Closing',
            '2027-11-21T19:30:00Z',
            '2027-11-21T23:30:00Z',
            hall,
            30,
            'The closing afternoon of Signal Weekender, with live music at Signal Hall.',
        ),
    ],
    passes: [
        {
            id: 'weekend-pass',
            name: 'Weekend pass',
            description: 'Five events across all three days.',
            admissionDescription:
                'General admission at the included events. Balcony access is separate.',
            price: '110.00',
            status: 'ACTIVE',
            quantityAvailable: 80,
            maxPerOrder: 6,
            eventIds: [
                'opening-night',
                'after-dark',
                'afternoon-sessions',
                'neon-nights-preview',
                'sunday-closing',
            ],
        },
        {
            id: 'saturday-pass',
            name: 'Saturday pass',
            description: 'Afternoon Sessions and Neon Nights.',
            admissionDescription:
                'General admission at the included events. Balcony access is separate.',
            price: '55.00',
            status: 'ACTIVE',
            quantityAvailable: 40,
            maxPerOrder: 4,
            eventIds: ['afternoon-sessions', 'neon-nights-preview'],
        },
    ],
};

export const festivalPreviewVariant = (search) => {
    const passesEnabled = new URLSearchParams(search).get('passes') !== 'none';
    return {
        ...festivalPreview,
        passesEnabled,
        description: passesEnabled
            ? festivalPreview.description
            : 'Three days of live music across St. John’s. Explore the program and book tickets on each event’s own page.',
    };
};

export const festivalPreviewEventHref = (event, search = '') =>
    `/preview/festival/events/${encodeURIComponent(event.slug)}${search}`;
