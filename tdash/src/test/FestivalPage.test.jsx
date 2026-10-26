import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FestivalPreview, {
    FestivalEventPreview,
    FestivalPageView,
} from '../pages/FestivalPage';
import { festivalPreview } from '../data/festivalPreview';

vi.mock('../lib/runtimeConfig', () => ({
    getApiBaseUrl: () => '/api/v1',
    getPaymentCurrency: () => 'cad',
    getPolicyLinks: () => ({}),
}));

const renderJourney = (entry = '/preview/festival') =>
    render(
        <MemoryRouter initialEntries={[entry]}>
            <Routes>
                <Route path="/preview/festival" element={<FestivalPreview />} />
                <Route
                    path="/preview/festival/events/:slug"
                    element={<FestivalEventPreview />}
                />
            </Routes>
        </MemoryRouter>,
    );

describe('festival customer journey', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('lists events across three dates, with event-page links and no individual ticket controls on the festival hub', () => {
        renderJourney();
        expect(
            screen.getByRole('heading', { name: 'Signal Weekender' }),
        ).toBeInTheDocument();
        expect(
            screen.getAllByRole('link', {
                name: /^View event(?: & tickets)?: /,
            }),
        ).toHaveLength(6);
        expect(
            screen.getByRole('heading', { name: 'Friday, November 19' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Saturday, November 20' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Sunday, November 21' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /Add one General admission/ }),
        ).not.toBeInTheDocument();
        const exclusions = within(
            screen.getByRole('region', { name: 'Not included' }),
        );
        expect(exclusions.getByText('Rooftop Sessions')).toBeInTheDocument();
        expect(
            exclusions.getByText('Separate event tickets are required.'),
        ).toBeInTheDocument();
    });

    it('names both ticket paths, exposes pass admission and coverage, and distinguishes unavailable events', () => {
        renderJourney();
        const destinations = within(
            screen.getByRole('navigation', { name: 'Festival tickets' }),
        );
        expect(
            destinations.getByRole('link', { name: /Individual events/ }),
        ).toHaveAttribute('href', '#festival-program');
        expect(
            destinations.getByRole('link', { name: /Festival passes/ }),
        ).toHaveAttribute('href', '#festival-passes');
        const coverage = within(
            screen.getByRole('region', { name: 'Weekend pass includes' }),
        );
        expect(
            coverage.getByRole('list', { name: 'Included events' }),
        ).toBeVisible();
        expect(
            coverage.getByText(
                'General admission at the included events. Balcony access is separate.',
            ),
        ).toBeVisible();
        for (const date of ['Fri, Nov 19', 'Sat, Nov 20', 'Sun, Nov 21']) {
            expect(coverage.getByRole('heading', { name: date })).toBeVisible();
        }
        const friday = within(
            coverage.getByRole('list', {
                name: 'Included events on Friday, November 19',
            }),
        );
        expect(friday.getByRole('link', { name: /After Dark/ })).toBeVisible();
        expect(friday.getByText('11:00 p.m.')).toBeVisible();
        const soldOutEvent = screen
            .getByRole('link', { name: 'View event: Rooftop Sessions' })
            .closest('article');
        expect(within(soldOutEvent).getByText('Sold out')).toBeVisible();
        expect(
            within(soldOutEvent).queryByText(/From \$/),
        ).not.toBeInTheDocument();
        const passSection = screen.getByRole('complementary', {
            name: 'Festival pass selection',
        });
        const faq = screen.getByRole('heading', { name: 'Tickets & entry' });
        expect(
            passSection.compareDocumentPosition(faq) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('filters by date and venue, with a reset for empty combinations', () => {
        renderJourney();
        fireEvent.click(screen.getByRole('button', { name: 'Sat, Nov 20' }));
        expect(
            screen.getAllByRole('link', {
                name: /^View event(?: & tickets)?: /,
            }),
        ).toHaveLength(3);
        fireEvent.change(screen.getByLabelText('Filter events by venue'), {
            target: { value: 'signal-hall' },
        });
        expect(
            screen.getAllByRole('link', {
                name: /^View event(?: & tickets)?: /,
            }),
        ).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Fri, Nov 19' }));
        fireEvent.change(screen.getByLabelText('Filter events by venue'), {
            target: { value: 'rooftop' },
        });
        expect(
            screen.getByRole('heading', {
                name: 'No events match these filters.',
            }),
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: 'Show all events' }),
        );
        expect(
            screen.getAllByRole('link', {
                name: /^View event(?: & tickets)?: /,
            }),
        ).toHaveLength(6);
    });

    it('retains date and venue when both controls change before the next render', () => {
        renderJourney();
        act(() => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Sat, Nov 20' }),
            );
            fireEvent.change(screen.getByLabelText('Filter events by venue'), {
                target: { value: 'signal-hall' },
            });
        });
        expect(
            screen.getAllByRole('link', {
                name: /^View event(?: & tickets)?: /,
            }),
        ).toHaveLength(1);
        expect(
            screen.getByRole('link', {
                name: 'View event & tickets: Neon Nights',
            }),
        ).toHaveAttribute(
            'href',
            '/preview/festival/events/neon-nights-preview?date=2027-11-20&venue=signal-hall',
        );
    });

    it('navigates to an event where its tickets are sold, then restores the festival filters on return', () => {
        renderJourney(
            '/preview/festival?date=2027-11-20&venue=signal-hall&pass=saturday-pass',
        );
        fireEvent.click(
            screen.getByRole('link', {
                name: 'View event & tickets: Neon Nights',
            }),
        );
        expect(
            screen.getByRole('heading', { name: 'Neon Nights' }),
        ).toBeInTheDocument();
        const eventTickets = within(
            screen.getByRole('complementary', { name: 'Ticket selection' }),
        );
        expect(
            eventTickets.getByText(
                'Tickets on this page cover this event only.',
            ),
        ).toBeInTheDocument();
        expect(
            eventTickets.getByRole('group', { name: 'Event ticket admission' }),
        ).toContainElement(
            eventTickets.getByRole('link', { name: /Also included in:/ }),
        );
        expect(
            screen.getByRole('button', {
                name: 'Add one General admission ticket',
            }),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: 'Signal Weekender' }));
        expect(
            screen.getAllByRole('link', {
                name: /^View event(?: & tickets)?: /,
            }),
        ).toHaveLength(1);
        expect(
            screen.getByRole('radio', { name: /Saturday pass/ }),
        ).toBeChecked();
        expect(
            screen.getByRole('button', { name: 'Sat, Nov 20' }),
        ).toHaveAttribute('aria-pressed', 'true');
        expect(document.activeElement.id).toBe('festival-program');
        fireEvent.click(
            screen.getByRole('link', {
                name: 'View event & tickets: Neon Nights',
            }),
        );
        fireEvent.click(
            screen.getByRole('link', { name: /Also included in:/ }),
        );
        expect(document.activeElement.id).toBe('festival-passes');
    });

    it('renders event-tickets-only festivals without a pass selector or pass coverage claims', () => {
        renderJourney('/preview/festival?passes=none');
        expect(
            screen.queryByRole('heading', { name: 'Festival passes' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('complementary', {
                name: 'Festival pass selection',
            }),
        ).not.toBeInTheDocument();
        expect(
            screen.getAllByRole('link', {
                name: /^View event(?: & tickets)?: /,
            }),
        ).toHaveLength(6);
        expect(
            screen.queryByText(/Included in Weekend pass/),
        ).not.toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('link', {
                name: 'View event & tickets: Neon Nights',
            }),
        );
        expect(
            screen.getByRole('button', {
                name: 'Add one General admission ticket',
            }),
        ).toBeInTheDocument();
        expect(screen.queryByText(/Also included in/)).not.toBeInTheDocument();
    });

    it('updates exact pass coverage, enforces quantity caps, and never submits a preview pass purchase', () => {
        renderJourney();
        fireEvent.click(screen.getByRole('radio', { name: /Saturday pass/ }));
        const panel = within(
            screen.getByRole('complementary', {
                name: 'Festival pass selection',
            }),
        );
        expect(panel.getByText('2 events included')).toBeInTheDocument();
        const exclusions = panel.getByRole('region', { name: 'Not included' });
        for (const name of [
            'Opening Night',
            'After Dark',
            'Rooftop Sessions',
            'Sunday Closing',
        ]) {
            expect(exclusions).toHaveTextContent(name);
        }

        expect(
            panel.getByRole('heading', { name: 'Saturday pass includes' }),
        ).toBeInTheDocument();
        expect(
            within(
                panel.getByRole('region', { name: 'Your selection' }),
            ).getByText('Saturday pass'),
        ).toBeInTheDocument();
        const opening = within(
            screen.getByRole('article', { name: 'Opening Night' }),
        );
        expect(
            opening.getByRole('group', { name: 'Admission for Opening Night' }),
        ).toHaveTextContent('Not included in Saturday pass');
        const neon = within(
            screen.getByRole('article', { name: 'Neon Nights' }),
        );
        expect(
            neon.getByRole('group', { name: 'Admission for Neon Nights' }),
        ).toHaveTextContent('Included in Saturday pass');

        expect(screen.getAllByText('Included in Saturday pass')).toHaveLength(
            2,
        );
        const add = panel.getByRole('button', {
            name: 'Add one festival pass',
        });
        for (let i = 0; i < 5; i += 1) fireEvent.click(add);
        expect(add).toBeDisabled();
        expect(
            panel.getByLabelText('Festival passes selected'),
        ).toHaveTextContent('4');
        fireEvent.click(
            panel.getByRole('button', { name: 'Continue with saturday pass' }),
        );
        expect(panel.getByRole('status', { name: '' })).toHaveTextContent(
            'Festival pass checkout is not connected yet.',
        );
        expect(fetch).not.toHaveBeenCalled();
    });

    it('stops pass selection when its sales window closes while browsing', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-20T18:00:00Z'));
        const festival = {
            ...festivalPreview,
            passes: [
                {
                    ...festivalPreview.passes[0],
                    salesEnd: '2026-10-20T18:00:01Z',
                },
            ],
        };
        render(
            <MemoryRouter>
                <FestivalPageView festival={festival} preview />
            </MemoryRouter>,
        );
        const button = screen.getByRole('button', {
            name: 'Continue with weekend pass',
        });
        expect(button).toBeEnabled();
        act(() => vi.advanceTimersByTime(2000));
        expect(button).toBeDisabled();
        expect(
            screen.getByLabelText('Festival passes selected'),
        ).toHaveTextContent('0');
    });

    it('handles an unknown child event without substituting an unrelated event', () => {
        renderJourney('/preview/festival/events/unknown');
        expect(
            screen.getByRole('heading', { name: 'Event unavailable' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: 'Neon Nights' }),
        ).not.toBeInTheDocument();
    });
});
