import React from 'react';
import { EventOnSaleView } from './EventOnSalePage';
import { festivalPreview } from '../data/festivalPreview';

const sample = festivalPreview.events.find(
    (event) => event.slug === 'neon-nights-preview',
);

export default function EventOnSalePreview() {
    return (
        <EventOnSaleView
            event={sample}
            preview
            festivalContext={{
                name: festivalPreview.name,
                href: '/preview/festival',
                passesHref: '/preview/festival#festival-passes',
                passesAvailable: true,
                includedPassNames: ['Weekend pass', 'Saturday pass'],
            }}
        />
    );
}
