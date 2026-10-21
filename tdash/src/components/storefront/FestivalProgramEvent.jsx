import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock3, MapPin } from 'lucide-react';
import { festivalEventPrice } from '../../lib/festivalProgram';
import { formatEventDate } from '../../lib/eventTime';
import { formatEventMoney, getEventSaleState } from '../../lib/publicEvent';

export default function FestivalProgramEvent({
    event,
    timeZone,
    selectedPass,
    included,
    href,
    currency,
    now,
}) {
    const sale = getEventSaleState(event, now);
    const price = festivalEventPrice(event, now);
    const hasTime =
        Boolean(event.startDatetime) &&
        Number.isFinite(Date.parse(event.startDatetime));
    return (
        <article
            className="sf-program-event"
            aria-labelledby={`program-event-${event.id}`}
        >
            <div className="sf-program-event-detail">
                <div className="sf-program-event-title">
                    <p className="sf-eyebrow">
                        {event.category || 'Live event'}
                    </p>
                    <h4 id={`program-event-${event.id}`}>
                        <Link to={href}>{event.name}</Link>
                    </h4>
                </div>
                <div className="sf-program-event-facts">
                    <div className="sf-program-time">
                        <Clock3 size={15} aria-hidden="true" />
                        {hasTime ? (
                            <time dateTime={event.startDatetime}>
                                {formatEventDate(
                                    event.startDatetime,
                                    timeZone,
                                    {
                                        weekday: undefined,
                                        month: undefined,
                                        day: undefined,
                                    },
                                )}
                            </time>
                        ) : (
                            'Time TBA'
                        )}
                    </div>
                    <p className="sf-program-venue">
                        <MapPin size={15} aria-hidden="true" />
                        {event.venue?.name || 'Venue to be announced'}
                    </p>
                </div>
            </div>
            <div
                className="sf-program-event-action"
                role="group"
                aria-label={`Admission for ${event.name}`}
            >
                <p
                    className={`sf-program-price ${price === null ? 'sf-program-unavailable' : ''}`}
                >
                    {price !== null ? (
                        <>
                            <span>
                                {price === 0
                                    ? 'Event tickets'
                                    : 'Event tickets from'}
                            </span>{' '}
                            <strong>
                                {price === 0
                                    ? 'Free'
                                    : formatEventMoney(price, currency)}
                            </strong>
                        </>
                    ) : sale.available ? (
                        'Tickets unavailable'
                    ) : (
                        sale.label
                    )}
                </p>
                <Link
                    className="sf-event-page-link"
                    to={href}
                    aria-label={`${price !== null ? 'View event & tickets' : 'View event'}: ${event.name}`}
                >
                    {price !== null ? 'View event & tickets' : 'View event'}
                    <ArrowRight size={15} aria-hidden="true" />
                </Link>
                {selectedPass && (
                    <p
                        className={`sf-program-coverage ${included ? 'is-included' : ''}`}
                    >
                        {included && <Check size={15} aria-hidden="true" />}
                        {included
                            ? `Included in ${selectedPass.name}`
                            : `Not included in ${selectedPass.name}`}
                    </p>
                )}
            </div>
        </article>
    );
}
