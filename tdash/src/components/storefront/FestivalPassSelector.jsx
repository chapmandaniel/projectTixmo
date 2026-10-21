import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Minus, Plus, Ticket } from 'lucide-react';
import { StorefrontBrand, StorefrontButton } from './StorefrontPrimitives';
import {
    festivalDays,
    festivalEvents,
    passCoveredEvents,
} from '../../lib/festivalProgram';
import {
    eventTimeZone,
    formatEventMoney,
    getPublicTicketOffer,
} from '../../lib/publicEvent';
import { formatEventDate } from '../../lib/eventTime';

export default function FestivalPassSelector({
    festival,
    passes,
    selectedPass,
    onSelect,
    eventHref,
    currency,
    preview = false,
    onCheckout,
    now = Date.now(),
}) {
    const [quantities, setQuantities] = useState({});
    const [message, setMessage] = useState('');
    const covered = passCoveredEvents(festival, selectedPass);
    const excluded = festivalEvents(festival).filter(
        (event) => !covered.some((included) => included.id === event.id),
    );
    const includedDays = festivalDays(festival)
        .map((day) => ({
            ...day,
            events: day.events.filter((event) =>
                covered.some((included) => included.id === event.id),
            ),
        }))
        .filter((day) => day.events.length);
    const offer = getPublicTicketOffer(selectedPass, now);
    const quantity = Math.min(quantities[selectedPass.id] ?? 1, offer.max);
    const money = (value) => formatEventMoney(value, currency);
    const canContinue =
        offer.max > 0 &&
        covered.length > 0 &&
        quantity > 0 &&
        (preview || typeof onCheckout === 'function');
    const select = (pass) => {
        setMessage('');
        onSelect(pass.id);
    };
    const adjust = (delta) => {
        setMessage('');
        setQuantities((current) => ({
            ...current,
            [selectedPass.id]: Math.max(
                0,
                Math.min(offer.max, quantity + delta),
            ),
        }));
    };
    const continueWithPass = () => {
        if (!canContinue) return;
        if (preview) {
            setMessage(
                'This is a preview. Festival pass checkout is not connected yet.',
            );
            return;
        }
        onCheckout({
            festivalId: festival.id,
            passId: selectedPass.id,
            quantity,
        });
    };

    return (
        <section
            className="sf-ticket-panel sf-pass-panel"
            id="festival-passes"
            aria-labelledby="festival-pass-title"
            tabIndex={-1}
        >
            <p className="sf-eyebrow">One pass, multiple events</p>
            <div className="sf-ticket-heading">
                <h2 id="festival-pass-title">Festival passes</h2>
                <Ticket size={24} aria-hidden="true" />
            </div>
            <fieldset className="sf-pass-options">
                <legend>Choose a pass</legend>
                {passes.map((pass) => {
                    const passOffer = getPublicTicketOffer(pass, now);
                    return (
                        <label
                            key={pass.id}
                            className={`sf-pass-option ${pass.id === selectedPass.id ? 'is-selected' : ''}`}
                        >
                            <input
                                type="radio"
                                name="festival-pass"
                                value={pass.id}
                                checked={pass.id === selectedPass.id}
                                onChange={() => select(pass)}
                            />
                            <span>
                                <strong>{pass.name}</strong>
                                <span>{pass.description}</span>
                                {!passOffer.max && (
                                    <span className="sf-ticket-status">
                                        {passOffer.label}
                                    </span>
                                )}
                            </span>
                            <strong className="sf-pass-price">
                                {money(passOffer.price)}
                            </strong>
                        </label>
                    );
                })}
            </fieldset>
            <section
                className="sf-pass-coverage"
                aria-live="polite"
                aria-labelledby="pass-coverage-heading"
            >
                <h3 id="pass-coverage-heading">{selectedPass.name} includes</h3>
                <p className="sf-pass-included-count">
                    <Check size={17} aria-hidden="true" />
                    <strong>
                        {covered.length}{' '}
                        {covered.length === 1 ? 'event' : 'events'} included
                    </strong>
                    {includedDays.length > 0 && (
                        <span>
                            {includedDays.some((day) => day.key === 'tba')
                                ? 'Dates TBA'
                                : `across ${includedDays.length} ${includedDays.length === 1 ? 'day' : 'days'}`}
                        </span>
                    )}
                </p>
                {selectedPass.admissionDescription && (
                    <dl className="sf-pass-admission">
                        <dt>Admission</dt>
                        <dd>{selectedPass.admissionDescription}</dd>
                    </dl>
                )}
                <ul className="sf-pass-event-days" aria-label="Included events">
                    {includedDays.map((day) => (
                        <li key={day.key}>
                            <h4>{day.shortLabel}</h4>
                            <ul aria-label={`Included events on ${day.label}`}>
                                {day.events.map((event) => (
                                    <li key={event.id}>
                                        <Link to={eventHref(event)}>
                                            <span>
                                                {day.key === 'tba' ? (
                                                    'Time TBA'
                                                ) : (
                                                    <time
                                                        dateTime={
                                                            event.startDatetime
                                                        }
                                                    >
                                                        {formatEventDate(
                                                            event.startDatetime,
                                                            eventTimeZone(
                                                                festival,
                                                            ),
                                                            {
                                                                weekday:
                                                                    undefined,
                                                                month: undefined,
                                                                day: undefined,
                                                            },
                                                        )}
                                                    </time>
                                                )}
                                            </span>
                                            <span>{event.name}</span>
                                            <ArrowRight
                                                size={14}
                                                aria-hidden="true"
                                            />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
                {excluded.length > 0 && (
                    <section
                        className="sf-pass-exclusions"
                        aria-labelledby="pass-exclusions-heading"
                    >
                        <h4 id="pass-exclusions-heading">Not included</h4>
                        <p>
                            {new Intl.ListFormat(undefined, {
                                style: 'long',
                                type: 'conjunction',
                            }).format(excluded.map((event) => event.name))}
                        </p>
                        <p className="sf-pass-exclusion-note">
                            Separate event tickets are required.
                        </p>
                    </section>
                )}
            </section>
            <section
                className="sf-pass-checkout"
                aria-labelledby="pass-quantity-heading"
            >
                <h3 id="pass-quantity-heading">Your selection</h3>
                <div className="sf-pass-quantity">
                    <div>
                        <strong>{selectedPass.name}</strong>
                        <span>
                            {currency.toUpperCase()} · {money(offer.price)} each
                        </span>
                    </div>
                    <span className="sf-pass-quantity-label">Quantity</span>
                    <div
                        className="sf-stepper"
                        role="group"
                        aria-label={`${selectedPass.name} quantity`}
                    >
                        <button
                            type="button"
                            onClick={() => adjust(-1)}
                            disabled={!quantity}
                            aria-label="Remove one festival pass"
                        >
                            <Minus size={16} aria-hidden="true" />
                        </button>
                        <output aria-label="Festival passes selected">
                            {quantity}
                        </output>
                        <button
                            type="button"
                            onClick={() => adjust(1)}
                            disabled={quantity >= offer.max}
                            aria-label="Add one festival pass"
                        >
                            <Plus size={16} aria-hidden="true" />
                        </button>
                    </div>
                </div>
                <div
                    className="sf-subtotal"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <span>Pass subtotal</span>
                    <strong>
                        {money(
                            (Math.round(offer.price * 100) * quantity) / 100,
                        )}
                    </strong>
                </div>
                <p className="sf-fee-note">
                    Final total confirmed at checkout.
                </p>
                <StorefrontButton
                    disabled={!canContinue}
                    onClick={continueWithPass}
                >
                    Continue with {selectedPass.name.toLowerCase()}
                    <ArrowRight size={16} aria-hidden="true" />
                </StorefrontButton>
                {message && (
                    <p className="sf-inline-message" role="status">
                        {message}
                    </p>
                )}
                {!offer.max && (
                    <p className="sf-inline-message">{offer.label}</p>
                )}
                <p className="sf-reservation-note">
                    For one event, choose it from the program.
                </p>
            </section>
            <div className="sf-ticket-footer">
                <StorefrontBrand />
                <span>Festival ticketing</span>
            </div>
        </section>
    );
}
