import React from 'react';
import { Link } from 'react-router-dom';
import './storefront.css';

export const ENDED_EVENT_HEADING = 'This event has ended';
export const ENDED_EVENT_BODY =
    'Ticket sales are closed. Tickets you already bought are in My tickets.';
export const UNDATED_EVENT_HEADING = "This event isn't open for sale yet";
export const UNDATED_EVENT_BODY =
    "Tickets aren't on sale until the organizer sets a date.";

// The public payload decides this. Ended wins when an end instant has also passed.
export const closedSaleCopy = (event) => {
    if (event?.ended) return { heading: ENDED_EVENT_HEADING, body: ENDED_EVENT_BODY };
    if (event?.undated)
        return { heading: UNDATED_EVENT_HEADING, body: UNDATED_EVENT_BODY };
    return null;
};

export function ClosedSaleNotice({ event, eventHref = '' }) {
    const copy = closedSaleCopy(event);
    if (!copy) return null;
    return (
        <div className="sf-closed-sale">
            <h2 id="tickets-title">{copy.heading}</h2>
            <p>{copy.body}</p>
            {eventHref ? (
                <p className="sf-closed-sale-links">
                    <Link to={eventHref}>Back to the event</Link>
                    <Link to="/wallet">My tickets</Link>
                </p>
            ) : null}
        </div>
    );
}
