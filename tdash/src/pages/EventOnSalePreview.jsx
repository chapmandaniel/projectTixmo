import React from 'react';
import { EventOnSaleView } from './EventOnSalePage';

// Development-only sample. No API calls, order creation, or real availability.
const sample = {
    id: 'preview-event',
    slug: 'neon-nights-preview',
    name: 'Neon Nights',
    category: 'Electronic',
    description:
        'A night for the dance floor. Deep house, late-night selections, and a room full of people here for the music.\n\nJoin us at Signal Hall for an evening of electronic music, from the first warm-up set to the final track.',
    status: 'ON_SALE',
    startDatetime: '2027-11-20T23:30:00Z',
    endDatetime: '2027-11-21T05:30:00Z',
    timezone: 'America/St_Johns',
    images: { main: '/images/event-onsale-preview.jpg' },
    organization: { name: 'Signal Events' },
    venue: {
        name: 'Signal Hall',
        address: {
            line1: '123 Water Street',
            city: 'St. John’s',
            province: 'NL',
            country: 'Canada',
        },
    },
    ticketTypes: [
        {
            id: 'preview-early',
            name: 'Early entry',
            description: 'General admission · first release',
            price: '25.00',
            status: 'ACTIVE',
            quantityAvailable: 0,
            maxPerOrder: 4,
            sortOrder: 0,
        },
        {
            id: 'preview-ga',
            name: 'General admission',
            description: 'Entry to the event · standing',
            price: '35.00',
            status: 'ACTIVE',
            quantityAvailable: 120,
            maxPerOrder: 6,
            sortOrder: 1,
        },
        {
            id: 'preview-vip',
            name: 'Balcony access',
            description: 'Event entry + upper-level viewing',
            price: '55.00',
            status: 'ACTIVE',
            quantityAvailable: 24,
            maxPerOrder: 4,
            sortOrder: 2,
        },
    ],
};

export default function EventOnSalePreview() {
    return <EventOnSaleView event={sample} preview />;
}
