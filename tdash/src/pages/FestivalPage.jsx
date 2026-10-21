import React, { useEffect, useState } from 'react';
import {
    Link,
    useLocation,
    useParams,
    useSearchParams,
} from 'react-router-dom';
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Check,
    MapPin,
    Ticket,
} from 'lucide-react';
import { StorefrontBrand } from '../components/storefront/StorefrontPrimitives';
import FestivalPassSelector from '../components/storefront/FestivalPassSelector';
import {
    festivalDays,
    festivalEventPrice,
    festivalEvents,
    festivalPasses,
    passCoveredEvents,
} from '../lib/festivalProgram';
import {
    eventArtwork,
    eventTimeZone,
    formatEventMoney,
    getEventSaleState,
} from '../lib/publicEvent';
import { getPaymentCurrency, getPolicyLinks } from '../lib/runtimeConfig';
import { EventOnSaleView } from './EventOnSalePage';
import {
    festivalPreviewVariant,
    festivalPreviewEventHref,
} from '../data/festivalPreview';

export const FestivalPageView = ({
    festival,
    preview = false,
    eventHref,
    onPassCheckout,
}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { hash } = useLocation();
    const [imageFailed, setImageFailed] = useState(false);
    const [now, setNow] = useState(Date.now());
    const events = festivalEvents(festival);
    const days = festivalDays(festival);
    const passes = festivalPasses(festival);
    const selectedPass =
        passes.find((pass) => pass.id === searchParams.get('pass')) ||
        passes[0];
    const coveredIds = new Set(
        passCoveredEvents(festival, selectedPass).map((event) => event.id),
    );
    const selectedDay = days.some((day) => day.key === searchParams.get('date'))
        ? searchParams.get('date')
        : 'all';
    const venues = [
        ...new Map(
            events
                .filter((event) => event.venue?.id)
                .map((event) => [event.venue.id, event.venue]),
        ).values(),
    ];
    const selectedVenue = venues.some(
        (venue) => venue.id === searchParams.get('venue'),
    )
        ? searchParams.get('venue')
        : 'all';
    const visibleDays = days
        .filter((day) => selectedDay === 'all' || day.key === selectedDay)
        .map((day) => ({
            ...day,
            events: day.events.filter(
                (event) =>
                    selectedVenue === 'all' ||
                    event.venue?.id === selectedVenue,
            ),
        }))
        .filter((day) => day.events.length);
    const visibleCount = visibleDays.reduce(
        (sum, day) => sum + day.events.length,
        0,
    );
    const currency = getPaymentCurrency();
    const policies = getPolicyLinks();
    const artwork = eventArtwork(festival);
    const money = (value) => formatEventMoney(value, currency);
    const hrefForEvent = (event) =>
        eventHref ? eventHref(event) : `/e/${encodeURIComponent(event.slug)}`;
    const setFilter = (key, value) => {
        const next = new URLSearchParams(searchParams);
        if (value === 'all') next.delete(key);
        else next.set(key, value);
        setSearchParams(next, { replace: true });
    };

    useEffect(() => {
        if (!['#festival-program', '#festival-passes'].includes(hash)) return;
        const section = document.getElementById(hash.slice(1));
        section?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
        section?.focus({ preventScroll: true });
    }, [hash]);

    useEffect(() => {
        const previousTitle = document.title;
        document.title = `${festival.name} · Tixmo`;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => {
            document.title = previousTitle;
            window.clearInterval(timer);
        };
    }, [festival.name]);

    return (
        <div className="event-storefront sf-festival" id="event-top">
            <a className="sf-skip" href="#festival-program">
                Skip to festival program
            </a>
            {preview && (
                <div className="sf-preview sf-festival-preview">
                    <span>
                        Design preview · sample festival · purchases disabled
                    </span>
                    <nav aria-label="Preview configurations">
                        <Link
                            to="/preview/festival"
                            aria-current={
                                festival.passesEnabled ? 'page' : undefined
                            }
                        >
                            With passes
                        </Link>
                        <Link
                            to="/preview/festival?passes=none"
                            aria-current={
                                !festival.passesEnabled ? 'page' : undefined
                            }
                        >
                            Event tickets only
                        </Link>
                    </nav>
                </div>
            )}
            <header className="sf-header sf-container">
                <StorefrontBrand />
                <nav aria-label="Customer navigation">
                    <a href="#festival-program">Program</a>
                    <Link to="/wallet">
                        <Ticket size={17} aria-hidden="true" />
                        My tickets
                    </Link>
                </nav>
            </header>
            <main>
                <section
                    className={`sf-hero sf-festival-hero ${!artwork || imageFailed ? 'sf-hero-no-image' : ''}`}
                    aria-labelledby="festival-name"
                >
                    {artwork && !imageFailed && (
                        <img
                            className="sf-hero-image"
                            src={artwork}
                            alt=""
                            fetchpriority="high"
                            onError={() => setImageFailed(true)}
                        />
                    )}
                    <div className="sf-hero-shade" />
                    <div className="sf-hero-content sf-container">
                        <p className="sf-kicker">
                            Festival / {festival.city || 'Live events'}
                        </p>
                        <p className="sf-presenter">
                            {festival.organization?.name
                                ? `${festival.organization.name} presents`
                                : 'Live on Tixmo'}
                        </p>
                        <h1 id="festival-name">{festival.name}</h1>
                        <div className="sf-hero-meta">
                            <span>
                                <CalendarDays size={17} aria-hidden="true" />
                                {festival.dateLabel || 'Dates to be announced'}
                            </span>
                            <span>
                                <MapPin size={17} aria-hidden="true" />
                                {venues.length}{' '}
                                {venues.length === 1 ? 'venue' : 'venues'} ·{' '}
                                {events.length}{' '}
                                {events.length === 1 ? 'event' : 'events'}
                            </span>
                        </div>
                    </div>
                </section>
                <div className="sf-container sf-festival-overview">
                    <p>{festival.description}</p>
                    <nav
                        className="sf-festival-destinations"
                        aria-label="Festival tickets"
                    >
                        <a href="#festival-program">
                            <span>
                                <strong>Individual events</strong>
                                <span>Book an event’s tickets</span>
                            </span>
                            <ArrowDown size={19} aria-hidden="true" />
                        </a>
                        {passes.length > 0 && (
                            <a href="#festival-passes">
                                <span>
                                    <strong>Festival passes</strong>
                                    <span>Compare pass coverage</span>
                                </span>
                                <ArrowDown size={19} aria-hidden="true" />
                            </a>
                        )}
                    </nav>
                </div>
                <div
                    className={`sf-container sf-festival-layout ${!passes.length ? 'sf-festival-layout-no-passes' : ''}`}
                >
                    <div className="sf-festival-main">
                        <section
                            id="festival-program"
                            className="sf-program"
                            aria-labelledby="program-heading"
                            tabIndex={-1}
                        >
                            <div className="sf-program-heading">
                                <div>
                                    <h2 id="program-heading">
                                        Individual events
                                    </h2>
                                    <p>
                                        Tickets are sold on each event’s own
                                        page.
                                    </p>
                                </div>
                                <label className="sf-venue-filter">
                                    <span className="sf-visually-hidden">
                                        Filter events by venue
                                    </span>
                                    <MapPin size={15} aria-hidden="true" />
                                    <select
                                        value={selectedVenue}
                                        onChange={(e) =>
                                            setFilter('venue', e.target.value)
                                        }
                                    >
                                        <option value="all">All venues</option>
                                        {venues.map((venue) => (
                                            <option
                                                value={venue.id}
                                                key={venue.id}
                                            >
                                                {venue.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div
                                className="sf-date-filters"
                                role="group"
                                aria-label="Filter events by date"
                            >
                                <button
                                    type="button"
                                    aria-pressed={selectedDay === 'all'}
                                    onClick={() => setFilter('date', 'all')}
                                >
                                    All dates
                                </button>
                                {days.map((day) => (
                                    <button
                                        type="button"
                                        key={day.key}
                                        aria-pressed={selectedDay === day.key}
                                        onClick={() =>
                                            setFilter('date', day.key)
                                        }
                                    >
                                        {day.shortLabel}
                                    </button>
                                ))}
                            </div>
                            <div className="sf-program-caption">
                                <span>
                                    Times are local to{' '}
                                    {festival.city || eventTimeZone(festival)}.
                                </span>
                                <span role="status" aria-live="polite">
                                    {visibleCount}{' '}
                                    {visibleCount === 1 ? 'event' : 'events'}
                                </span>
                            </div>
                            {visibleDays.map((day) => (
                                <section
                                    className="sf-program-day"
                                    key={day.key}
                                    aria-labelledby={`day-${day.key}`}
                                >
                                    <div className="sf-program-day-heading">
                                        <h3 id={`day-${day.key}`}>
                                            <CalendarDays
                                                size={16}
                                                aria-hidden="true"
                                            />
                                            {day.key === 'tba' ? (
                                                day.label
                                            ) : (
                                                <time dateTime={day.key}>
                                                    {day.label}
                                                </time>
                                            )}
                                        </h3>
                                        <span>
                                            {day.events.length}{' '}
                                            {day.events.length === 1
                                                ? 'event'
                                                : 'events'}
                                        </span>
                                    </div>
                                    <div>
                                        {day.events.map((event) => {
                                            const sale = getEventSaleState(
                                                event,
                                                now,
                                            );
                                            const price = festivalEventPrice(
                                                event,
                                                now,
                                            );
                                            return (
                                                <article
                                                    className="sf-program-event"
                                                    key={event.id}
                                                >
                                                    <div className="sf-program-event-detail">
                                                        <div className="sf-program-event-title">
                                                            <h4>
                                                                <Link
                                                                    to={hrefForEvent(
                                                                        event,
                                                                    )}
                                                                >
                                                                    {event.name}
                                                                </Link>
                                                            </h4>
                                                        </div>
                                                        <div className="sf-program-event-facts">
                                                            <div className="sf-program-time">
                                                                {day.key ===
                                                                'tba' ? (
                                                                    'TBA'
                                                                ) : (
                                                                    <time
                                                                        dateTime={
                                                                            event.startDatetime
                                                                        }
                                                                    >
                                                                        {new Intl.DateTimeFormat(
                                                                            undefined,
                                                                            {
                                                                                timeZone:
                                                                                    eventTimeZone(
                                                                                        festival,
                                                                                    ),
                                                                                hour: 'numeric',
                                                                                minute: '2-digit',
                                                                            },
                                                                        ).format(
                                                                            new Date(
                                                                                event.startDatetime,
                                                                            ),
                                                                        )}
                                                                    </time>
                                                                )}
                                                            </div>
                                                            <p className="sf-program-venue">
                                                                <span>
                                                                    {event.venue
                                                                        ?.name ||
                                                                        'Venue to be announced'}
                                                                </span>
                                                                <span>
                                                                    {event.category ||
                                                                        'Live event'}
                                                                </span>
                                                            </p>
                                                        </div>
                                                        {selectedPass && (
                                                            <p
                                                                className={`sf-program-coverage ${coveredIds.has(event.id) ? 'is-included' : ''}`}
                                                            >
                                                                {coveredIds.has(
                                                                    event.id,
                                                                ) && (
                                                                    <Check
                                                                        size={
                                                                            15
                                                                        }
                                                                        aria-hidden="true"
                                                                    />
                                                                )}
                                                                {coveredIds.has(
                                                                    event.id,
                                                                )
                                                                    ? `Included in ${selectedPass.name.toLowerCase()}`
                                                                    : 'Separate event ticket'}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="sf-program-event-action">
                                                        <p
                                                            className={
                                                                price === null
                                                                    ? 'sf-program-unavailable'
                                                                    : ''
                                                            }
                                                        >
                                                            {price !== null ? (
                                                                price === 0 ? (
                                                                    'Free tickets'
                                                                ) : (
                                                                    <>
                                                                        <span>
                                                                            From
                                                                        </span>{' '}
                                                                        <strong>
                                                                            {money(
                                                                                price,
                                                                            )}
                                                                        </strong>
                                                                    </>
                                                                )
                                                            ) : sale.available ? (
                                                                'Tickets unavailable'
                                                            ) : (
                                                                sale.label
                                                            )}
                                                        </p>
                                                        <Link
                                                            className="sf-event-page-link"
                                                            to={hrefForEvent(
                                                                event,
                                                            )}
                                                            aria-label={`${price !== null ? 'View event & tickets' : 'View event'}: ${event.name}`}
                                                        >
                                                            {price !== null
                                                                ? 'View event & tickets'
                                                                : 'View event'}
                                                            <ArrowRight
                                                                size={15}
                                                                aria-hidden="true"
                                                            />
                                                        </Link>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                            {!visibleDays.length && (
                                <div className="sf-program-empty">
                                    <h3>
                                        {events.length
                                            ? 'No events match these filters.'
                                            : 'The program is coming soon.'}
                                    </h3>
                                    {events.length ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next =
                                                    new URLSearchParams(
                                                        searchParams,
                                                    );
                                                next.delete('date');
                                                next.delete('venue');
                                                setSearchParams(next, {
                                                    replace: true,
                                                });
                                            }}
                                        >
                                            Show all events
                                            <ArrowRight
                                                size={15}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    ) : (
                                        <p>
                                            Check back for event announcements
                                            and ticket details.
                                        </p>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>
                    {selectedPass && (
                        <aside
                            className="sf-festival-pass-column"
                            aria-label="Festival pass selection"
                        >
                            <FestivalPassSelector
                                festival={festival}
                                passes={passes}
                                selectedPass={selectedPass}
                                onSelect={(id) => setFilter('pass', id)}
                                eventHref={hrefForEvent}
                                currency={currency}
                                preview={preview}
                                onCheckout={onPassCheckout}
                                now={now}
                            />
                        </aside>
                    )}
                </div>
                <section className="sf-container sf-detail-section sf-info sf-festival-info">
                    <p className="sf-eyebrow">Planning your festival</p>
                    <h2>Tickets & entry</h2>
                    <details>
                        <summary>
                            Can I book just one event?
                            <ArrowDown size={16} aria-hidden="true" />
                        </summary>
                        <p>
                            Yes. Open that event’s page to choose its tickets.
                            Each event has its own availability and admission
                            details.
                        </p>
                    </details>
                    {passes.length > 0 && (
                        <details>
                            <summary>
                                Does a pass include every event?
                                <ArrowDown size={16} aria-hidden="true" />
                            </summary>
                            <p>
                                Only the events listed for your chosen pass are
                                included. Check the included events before
                                buying. Other events require their own tickets.
                            </p>
                        </details>
                    )}
                    <details>
                        <summary>
                            Where do I find entry and venue information?
                            <ArrowDown size={16} aria-hidden="true" />
                        </summary>
                        <p>
                            Open the individual event page for its start time,
                            location and admission information. Events can take
                            place at different venues on different days.
                        </p>
                    </details>
                </section>
            </main>
            <footer className="sf-footer sf-container">
                <StorefrontBrand />
                <span>Event ticketing</span>
                <div>
                    {policies.termsUrl && (
                        <a
                            href={policies.termsUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Terms
                        </a>
                    )}
                    {policies.privacyPolicyUrl && (
                        <a
                            href={policies.privacyPolicyUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Privacy
                        </a>
                    )}
                </div>
            </footer>
        </div>
    );
};

// Preview routes are registered only in development. They are the adapter until
// a real festival API and pass checkout exist; they never call purchase APIs.
export default function FestivalPreview() {
    const { search } = useLocation();
    return (
        <FestivalPageView
            festival={festivalPreviewVariant(search)}
            preview
            eventHref={(event) => festivalPreviewEventHref(event, search)}
        />
    );
}

export function FestivalEventPreview() {
    const { slug } = useParams();
    const { search } = useLocation();
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [slug]);
    const festival = festivalPreviewVariant(search);
    const event = festivalEvents(festival).find((item) => item.slug === slug);
    if (!event)
        return (
            <div className="event-storefront sf-loading">
                <StorefrontBrand to="/preview/festival" />
                <main>
                    <h1>Event unavailable</h1>
                    <Link
                        className="sf-text-link"
                        to={`/preview/festival${search}`}
                    >
                        <ArrowLeft size={16} aria-hidden="true" />
                        Back to festival
                    </Link>
                </main>
            </div>
        );
    const coverage = festivalPasses(festival).filter((pass) =>
        pass.eventIds?.includes(event.id),
    );
    return (
        <EventOnSaleView
            key={event.id}
            event={event}
            preview
            festivalContext={{
                name: festival.name,
                href: `/preview/festival${search}#festival-program`,
                passesHref: `/preview/festival${search}#festival-passes`,
                includedPassNames: coverage.map((pass) => pass.name),
                passesAvailable: festivalPasses(festival).length > 0,
            }}
        />
    );
}
