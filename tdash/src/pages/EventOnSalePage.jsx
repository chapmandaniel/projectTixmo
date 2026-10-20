import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowDown,
    ArrowRight,
    CalendarDays,
    Check,
    ChevronDown,
    Clock3,
    ExternalLink,
    Loader2,
    MapPin,
    Minus,
    Plus,
    Share2,
    Ticket,
} from 'lucide-react';
import {
    StorefrontBrand,
    StorefrontButton,
    StorefrontFact,
} from '../components/storefront/StorefrontPrimitives';
import {
    getApiBaseUrl,
    getPaymentCurrency,
    getPolicyLinks,
} from '../lib/runtimeConfig';
import { formatEventDate } from '../lib/eventTime';
import {
    checkoutSelection,
    eventAddress,
    eventArtwork,
    eventTimeZone,
    formatEventMoney,
    getEventSaleState,
    getPublicTicketOffer,
} from '../lib/publicEvent';

const eventDate = (event, options = {}) =>
    formatEventDate(event.startDatetime, eventTimeZone(event), options);

export const EventOnSaleView = ({ event, preview = false }) => {
    const navigate = useNavigate();
    const [quantities, setQuantities] = useState({});
    const [now, setNow] = useState(Date.now());
    const [shareMessage, setShareMessage] = useState('');
    const [imageFailed, setImageFailed] = useState(false);
    const [previewMessage, setPreviewMessage] = useState('');
    const currency = getPaymentCurrency();
    const policies = getPolicyLinks();
    const sale = getEventSaleState(event, now);
    const artwork = eventArtwork(event);
    const address = eventAddress(event.venue);
    const types = [...(event.ticketTypes || [])]
        .filter((ticket) => !ticket.status || ticket.status !== 'HIDDEN')
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const items = types.map((ticket) => {
        const offer = getPublicTicketOffer(ticket, now);
        return {
            ticket,
            offer,
            quantity: sale.available
                ? Math.min(quantities[ticket.id] || 0, offer.max)
                : 0,
        };
    });
    const safeQuantities = Object.fromEntries(
        items.map((item) => [item.ticket.id, item.quantity]),
    );
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal =
        items.reduce(
            (sum, item) =>
                sum + Math.round(item.offer.price * 100) * item.quantity,
            0,
        ) / 100;
    const availablePrices = items
        .filter((item) => item.offer.max > 0)
        .map((item) => item.offer.price);
    const startingPrice = availablePrices.length
        ? Math.min(...availablePrices)
        : null;
    const canSelect = sale.available && availablePrices.length > 0;
    const saleLabel =
        sale.available && !availablePrices.length
            ? 'Tickets unavailable'
            : sale.label;
    const money = (value) => formatEventMoney(value, currency);

    useEffect(() => {
        const previousTitle = document.title;
        document.title = `${event.name} · Tixmo`;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => {
            document.title = previousTitle;
            window.clearInterval(timer);
        };
    }, [event.name]);

    const changeQuantity = (item, delta) => {
        setPreviewMessage('');
        setQuantities((current) => ({
            ...current,
            [item.ticket.id]: Math.max(
                0,
                Math.min(item.offer.max, item.quantity + delta),
            ),
        }));
    };

    const continueToCheckout = () => {
        if (!canSelect || !count) return;
        if (preview) {
            setPreviewMessage(
                'This is a sample event. Checkout opens for published events.',
            );
            return;
        }
        const search = new URLSearchParams({
            tickets: checkoutSelection(safeQuantities),
        });
        navigate(`/checkout/${encodeURIComponent(event.slug)}?${search}`);
    };

    const shareEvent = async () => {
        try {
            const url = `${window.location.origin}/e/${encodeURIComponent(event.slug)}`;
            if (preview) {
                setShareMessage('Sharing is available for published events.');
                return;
            }
            if (navigator.share)
                await navigator.share({ title: event.name, url });
            else {
                await navigator.clipboard.writeText(url);
                setShareMessage('Event link copied');
            }
        } catch (error) {
            if (error.name !== 'AbortError')
                setShareMessage(
                    'Copy the event URL from your address bar to share.',
                );
        }
    };

    const focusTickets = () => {
        const panel = document.getElementById('event-tickets');
        panel?.scrollIntoView({
            behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
                .matches
                ? 'auto'
                : 'smooth',
            block: 'start',
        });
        panel?.focus({ preventScroll: true });
    };

    return (
        <div className="event-storefront" id="event-top">
            <a className="sf-skip" href="#event-details">
                Skip to event details
            </a>
            {preview && (
                <div className="sf-preview">
                    Design preview{' '}
                    <span>Sample event · ticket purchases disabled</span>
                </div>
            )}
            <header className="sf-header sf-container">
                <StorefrontBrand />
                <nav aria-label="Customer navigation">
                    <Link to="/wallet">
                        <Ticket size={17} aria-hidden="true" /> My tickets
                    </Link>
                    <button
                        type="button"
                        onClick={shareEvent}
                        aria-label="Share event"
                    >
                        <Share2 size={17} aria-hidden="true" />
                    </button>
                </nav>
            </header>
            <main>
                <section
                    className={`sf-hero ${!artwork || imageFailed ? 'sf-hero-no-image' : ''}`}
                    aria-labelledby="event-name"
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
                            {[event.category, event.venue?.address?.city]
                                .filter((value) => typeof value === 'string')
                                .join(' / ') || 'Live event'}
                        </p>
                        <p className="sf-presenter">
                            {event.organization?.name
                                ? `${event.organization.name} presents`
                                : 'Live on Tixmo'}
                        </p>
                        <h1 id="event-name">{event.name}</h1>
                        <div className="sf-hero-meta">
                            <span>
                                <CalendarDays size={17} aria-hidden="true" />
                                {eventDate(event, {
                                    year: 'numeric',
                                    hour: undefined,
                                    minute: undefined,
                                })}
                            </span>
                            <span>
                                <MapPin size={17} aria-hidden="true" />
                                {event.venue?.name || 'Venue to be announced'}
                            </span>
                        </div>
                        <StorefrontButton
                            className="sf-hero-cta"
                            onClick={focusTickets}
                        >
                            Choose tickets{' '}
                            <ArrowDown size={15} aria-hidden="true" />
                        </StorefrontButton>
                    </div>
                    <span className="sf-photo-caption" aria-hidden="true">
                        {event.category || 'Live events'} / Tixmo
                    </span>
                </section>

                <div className="sf-content sf-container">
                    <div className="sf-event-body">
                        <nav
                            className="sf-section-nav"
                            aria-label="Event sections"
                        >
                            <a href="#event-details">The event</a>
                            <a href="#event-venue">The venue</a>
                            <a href="#event-info">Good to know</a>
                        </nav>
                        <section
                            id="event-details"
                            className="sf-detail-section"
                        >
                            <p className="sf-eyebrow">The event</p>
                            <h2>About the event</h2>
                            <p className="sf-description">
                                {event.description ||
                                    'Event details will be shared by the organizer.'}
                            </p>
                            <div className="sf-facts">
                                <StorefrontFact
                                    icon={CalendarDays}
                                    label="Date"
                                >
                                    {eventDate(event, {
                                        year: 'numeric',
                                        hour: undefined,
                                        minute: undefined,
                                    })}
                                </StorefrontFact>
                                <StorefrontFact icon={Clock3} label="Starts at">
                                    {event.startDatetime
                                        ? eventDate(event, {
                                              weekday: undefined,
                                              month: undefined,
                                              day: undefined,
                                              timeZoneName: 'short',
                                          })
                                        : 'Time to be announced'}
                                </StorefrontFact>
                            </div>
                        </section>
                        <section id="event-venue" className="sf-detail-section">
                            <p className="sf-eyebrow">The venue</p>
                            <div className="sf-section-heading">
                                <h2>
                                    {event.venue?.name ||
                                        'Venue to be announced'}
                                </h2>
                                <MapPin size={25} aria-hidden="true" />
                            </div>
                            {address ? (
                                <>
                                    <p className="sf-venue-address">
                                        {address}
                                    </p>
                                    <a
                                        className="sf-text-link"
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue?.name || ''} ${address}`)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Get directions{' '}
                                        <ExternalLink
                                            size={14}
                                            aria-hidden="true"
                                        />
                                    </a>
                                </>
                            ) : (
                                <p className="sf-muted">
                                    The organizer will share the location
                                    details.
                                </p>
                            )}
                        </section>
                        <section
                            id="event-info"
                            className="sf-detail-section sf-info"
                        >
                            <p className="sf-eyebrow">Good to know</p>
                            <h2>Before you go</h2>
                            <details>
                                <summary>
                                    Where will I find my tickets?
                                    <ChevronDown size={17} aria-hidden="true" />
                                </summary>
                                <p>
                                    After your order is confirmed, sign in to{' '}
                                    <Link to="/wallet">My tickets</Link> to view
                                    your tickets and admission codes.
                                </p>
                            </details>
                            <details>
                                <summary>
                                    When are tickets reserved?
                                    <ChevronDown size={17} aria-hidden="true" />
                                </summary>
                                <p>
                                    Choosing a quantity does not reserve
                                    tickets. Availability and the final total
                                    are confirmed during checkout.
                                </p>
                            </details>
                            {policies.refundPolicyUrl && (
                                <details>
                                    <summary>
                                        What is the refund policy?
                                        <ChevronDown
                                            size={17}
                                            aria-hidden="true"
                                        />
                                    </summary>
                                    <p>
                                        Read the{' '}
                                        <a
                                            href={policies.refundPolicyUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            refund policy
                                        </a>{' '}
                                        before placing your order.
                                    </p>
                                </details>
                            )}
                        </section>
                        {event.organization?.name && (
                            <div className="sf-organizer">
                                <span
                                    className="sf-organizer-monogram"
                                    aria-hidden="true"
                                >
                                    {event.organization.name.slice(0, 1)}
                                </span>
                                <div>
                                    <span className="sf-eyebrow">
                                        Presented by
                                    </span>
                                    <p>{event.organization.name}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <aside
                        className="sf-ticket-column"
                        aria-label="Ticket selection"
                    >
                        <section
                            className="sf-ticket-panel"
                            id="event-tickets"
                            tabIndex={-1}
                            aria-labelledby="tickets-title"
                        >
                            <div
                                className={`sf-sale-state ${canSelect ? 'sf-sale-open' : ''}`}
                            >
                                <span />
                                {saleLabel}
                            </div>
                            <div className="sf-ticket-heading">
                                <h2 id="tickets-title">Get your tickets</h2>
                                <Ticket size={24} aria-hidden="true" />
                            </div>
                            <p className="sf-ticket-date">{eventDate(event)}</p>
                            <div className="sf-ticket-list">
                                {items.length ? (
                                    items.map((item) => (
                                        <div
                                            className="sf-ticket-row"
                                            key={item.ticket.id}
                                        >
                                            <div className="sf-ticket-name">
                                                <h3>{item.ticket.name}</h3>
                                                {item.ticket.description && (
                                                    <p>
                                                        {
                                                            item.ticket
                                                                .description
                                                        }
                                                    </p>
                                                )}
                                                {(!sale.available ||
                                                    !item.offer.max) && (
                                                    <span className="sf-ticket-status">
                                                        {sale.available
                                                            ? item.offer.label
                                                            : sale.label}
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                className={`sf-ticket-controls ${!item.offer.max ? 'sf-ticket-unavailable' : ''}`}
                                            >
                                                <div>
                                                    <strong>
                                                        {item.offer.price === 0
                                                            ? 'Free'
                                                            : money(
                                                                  item.offer
                                                                      .price,
                                                              )}
                                                    </strong>
                                                    <span>
                                                        {currency.toUpperCase()}{' '}
                                                        / ticket
                                                    </span>
                                                </div>
                                                <div
                                                    className="sf-stepper"
                                                    role="group"
                                                    aria-label={`${item.ticket.name} quantity`}
                                                >
                                                    <button
                                                        type="button"
                                                        aria-label={`Remove one ${item.ticket.name} ticket`}
                                                        disabled={
                                                            !item.quantity
                                                        }
                                                        onClick={() =>
                                                            changeQuantity(
                                                                item,
                                                                -1,
                                                            )
                                                        }
                                                    >
                                                        <Minus
                                                            size={16}
                                                            aria-hidden="true"
                                                        />
                                                    </button>
                                                    <output
                                                        aria-label={`${item.ticket.name} tickets selected`}
                                                    >
                                                        {item.quantity}
                                                    </output>
                                                    <button
                                                        type="button"
                                                        aria-label={`Add one ${item.ticket.name} ticket`}
                                                        disabled={
                                                            !sale.available ||
                                                            item.quantity >=
                                                                item.offer.max
                                                        }
                                                        onClick={() =>
                                                            changeQuantity(
                                                                item,
                                                                1,
                                                            )
                                                        }
                                                    >
                                                        <Plus
                                                            size={16}
                                                            aria-hidden="true"
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="sf-muted">
                                        Ticket details will be announced by the
                                        organizer.
                                    </p>
                                )}
                            </div>
                            <div
                                className="sf-subtotal"
                                aria-live="polite"
                                aria-atomic="true"
                            >
                                <span>
                                    {count
                                        ? `${count} ${count === 1 ? 'ticket' : 'tickets'}`
                                        : 'Select your tickets'}
                                </span>
                                <strong>{money(subtotal)}</strong>
                            </div>
                            <p className="sf-fee-note">
                                {count
                                    ? 'Subtotal · final total confirmed at checkout.'
                                    : 'Choose a quantity to continue.'}
                            </p>
                            <StorefrontButton
                                onClick={continueToCheckout}
                                disabled={!canSelect || !count}
                            >
                                {preview
                                    ? 'Preview checkout'
                                    : 'Continue to checkout'}
                                <ArrowRight size={18} aria-hidden="true" />
                            </StorefrontButton>
                            {previewMessage && (
                                <p className="sf-inline-message" role="status">
                                    {previewMessage}
                                </p>
                            )}
                            <p className="sf-reservation-note">
                                Availability is confirmed during checkout.
                            </p>
                            <div className="sf-ticket-footer">
                                <StorefrontBrand />
                                <span>Ticketing for live events</span>
                            </div>
                        </section>
                        <button
                            className="sf-share-link"
                            type="button"
                            onClick={shareEvent}
                        >
                            {shareMessage === 'Event link copied' ? (
                                <Check size={16} />
                            ) : (
                                <Share2 size={16} />
                            )}
                            Share this event
                        </button>
                    </aside>
                </div>
                <div className="sf-mobile-bar">
                    <div>
                        <span>
                            {count
                                ? `${count} ${count === 1 ? 'ticket' : 'tickets'}`
                                : startingPrice === null
                                  ? saleLabel
                                  : 'Tickets from'}
                        </span>
                        <strong>
                            {count
                                ? money(subtotal)
                                : startingPrice === null
                                  ? 'Check availability'
                                  : money(startingPrice)}
                        </strong>
                    </div>
                    <StorefrontButton onClick={focusTickets}>
                        Choose tickets{' '}
                        <ArrowRight size={16} aria-hidden="true" />
                    </StorefrontButton>
                </div>
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
            <div className="sf-share-message" role="status">
                {shareMessage}
            </div>
        </div>
    );
};

export default function EventOnSalePage() {
    const { slug } = useParams();
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState({
        slug: '',
        loading: true,
        event: null,
        error: '',
    });
    useEffect(() => {
        const controller = new AbortController();
        setState({ slug, loading: true, event: null, error: '' });
        const load = async () => {
            try {
                const response = await fetch(
                    `${getApiBaseUrl()}/events/public/${encodeURIComponent(slug)}`,
                    { signal: controller.signal, cache: 'no-store' },
                );
                const body = await response.json().catch(() => ({}));
                if (!response.ok)
                    throw new Error(
                        response.status === 404
                            ? 'This event is not available.'
                            : 'We could not load this event. Please try again.',
                    );
                const event = body?.data?.data || body?.data || body;
                if (!event?.id || !event?.name || !event?.slug)
                    throw new Error('This event is not available.');
                if (!controller.signal.aborted)
                    setState({ slug, loading: false, event, error: '' });
            } catch (error) {
                if (!controller.signal.aborted)
                    setState({
                        slug,
                        loading: false,
                        event: null,
                        error:
                            error.message ||
                            'We could not load this event. Please try again.',
                    });
            }
        };
        void load();
        return () => controller.abort();
    }, [slug, attempt]);
    if (state.loading || state.slug !== slug || !state.event)
        return (
            <div className="event-storefront sf-loading">
                <StorefrontBrand to="/wallet" />
                <main aria-live="polite">
                    {state.loading || state.slug !== slug ? (
                        <>
                            <Loader2 className="sf-loader" aria-hidden="true" />
                            <h1>Loading event…</h1>
                        </>
                    ) : (
                        <>
                            <h1>Event unavailable</h1>
                            <p>{state.error}</p>
                            <StorefrontButton
                                onClick={() => setAttempt((value) => value + 1)}
                            >
                                Try again
                            </StorefrontButton>
                        </>
                    )}
                </main>
            </div>
        );
    return (
        <EventOnSaleView key={eventIdentity(state.event)} event={state.event} />
    );
}

const eventIdentity = (event) => `${event.id}:${event.slug}`;
