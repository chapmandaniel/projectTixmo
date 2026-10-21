import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Minus, Plus, Ticket } from 'lucide-react';
import { StorefrontBrand, StorefrontButton } from './StorefrontPrimitives';
import {
    festivalDays,
    festivalEvents,
    passCoveredEvents,
} from '../../lib/festivalProgram';
import { formatEventMoney, getPublicTicketOffer } from '../../lib/publicEvent';

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
    const includedDays = festivalDays(festival).filter((day) =>
        day.events.some((event) =>
            covered.some((included) => included.id === event.id),
        ),
    );
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
            <p className="sf-pass-intro">
                Choose a pass and check exactly what’s included.
            </p>
            <fieldset className="sf-pass-options">
                <legend>1. Choose a pass</legend>
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
                <h3 id="pass-coverage-heading">2. What’s included</h3>
                <p className="sf-pass-included-count">
                    <Check size={17} aria-hidden="true" />
                    <strong>
                        {covered.length}{' '}
                        {covered.length === 1 ? 'event' : 'events'} included
                    </strong>
                </p>
                <p className="sf-pass-dates">
                    {includedDays.map((day) => day.shortLabel).join(' · ')}
                </p>
                {selectedPass.admissionDescription && (
                    <p className="sf-pass-admission">
                        {selectedPass.admissionDescription}
                    </p>
                )}
                <ul aria-label="Included events">
                    {covered.map((event) => (
                        <li key={event.id}>
                            <Link to={eventHref(event)}>
                                {event.name}
                                <ArrowRight size={15} aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                </ul>
                {excluded.length > 0 && (
                    <p className="sf-pass-exclusions">
                        {excluded.length === 1
                            ? `${excluded[0].name} is not included.`
                            : `${excluded.length} other events are not included.`}{' '}
                        Separate event tickets are required.
                    </p>
                )}
            </section>
            <section
                className="sf-pass-checkout"
                aria-labelledby="pass-quantity-heading"
            >
                <h3 id="pass-quantity-heading">3. Quantity and total</h3>
                <div className="sf-pass-quantity">
                    <div>
                        <strong>Passes</strong>
                        <span>
                            {currency.toUpperCase()} · {money(offer.price)} each
                        </span>
                    </div>
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
