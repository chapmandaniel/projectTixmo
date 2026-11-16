import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T15:00:00Z'));
});

import {
    answerMooseQuestion,
    eventSalesForRange,
    fallbackAnswer,
    lastWeekends,
    SUGGESTED_QUESTIONS,
} from '../features/analyticsDashboard/mooseAnswers';
import { selectAnalyticsDashboard } from '../features/analyticsDashboard/mockAnalytics';

const aurora28 = selectAnalyticsDashboard({ pageId: 'aurora-after-dark', range: '28' });
const aurora7 = selectAnalyticsDashboard({ pageId: 'aurora-after-dark', range: '7' });
const harbour28 = selectAnalyticsDashboard({ pageId: 'harbour-lights-festival', range: '28' });
const all28 = selectAnalyticsDashboard({ pageId: 'all', range: '28' });

describe('Moose answer engine', () => {
    beforeAll(() => {
        expect(SUGGESTED_QUESTIONS).toEqual([
            'Which event is selling fastest?',
            'How did last weekend compare?',
            'Where are my buyers coming from?',
            'What should I promote next?',
        ]);
    });

    it('names Harbour Lights Festival as the fastest seller and respects the event filter', () => {
        const sales = eventSalesForRange('28');
        expect(sales[0].name).toBe('Harbour Lights Festival');
        expect(sales[0].purchases).toBe(540);

        const allAnswer = answerMooseQuestion('Which event is selling fastest?', all28);
        expect(allAnswer).toContain('Harbour Lights Festival is selling fastest over last 28 days');
        expect(allAnswer).toContain('540 purchases');

        const auroraAnswer = answerMooseQuestion('Which event is selling fastest?', aurora28);
        expect(auroraAnswer).toContain('Harbour Lights Festival is selling fastest over last 28 days');
        expect(auroraAnswer).toContain("You're looking at Aurora After Dark right now, which has 118 purchases");

        const harbourAnswer = answerMooseQuestion('Which event is selling fastest?', harbour28);
        expect(harbourAnswer).toContain("That's the event you have selected right now.");
        expect(harbourAnswer).toContain('540 purchases');
    });

    it('changes fastest-seller and page numbers when the date range changes', () => {
        const sales7 = eventSalesForRange('7');
        expect(sales7[0].name).toBe('Harbour Lights Festival');
        expect(sales7[0].purchases).toBe(164);
        expect(sales7.find((item) => item.id === 'aurora-after-dark').purchases).toBe(28);

        const answer7 = answerMooseQuestion('Which event is selling fastest?', aurora7);
        expect(answer7).toContain('last 7 days');
        expect(answer7).toContain('164 purchases');
        expect(answer7).toContain('which has 28 purchases');
        expect(answer7).not.toContain('118 purchases');
    });

    it('compares last weekend using the chart dates in the current range', () => {
        const { latest, previous } = lastWeekends(aurora28);
        expect(latest).toEqual({ saturday: '2026-11-07', sunday: '2026-11-08' });
        expect(previous).toBeTruthy();

        const answer = answerMooseQuestion('How did last weekend compare?', aurora28);
        expect(answer).toMatch(/Last weekend \(Sat Nov 7-Sun Nov 8\)/);
        expect(answer).toContain('Aurora After Dark');
        expect(answer).toMatch(/\d+ visitors/);
        expect(answer).toMatch(/weekend before/);
    });

    it('describes buyer sources from the loaded channels and cities', () => {
        const answer = answerMooseQuestion('Where are my buyers coming from?', aurora28);
        expect(answer).toContain('Aurora After Dark');
        expect(answer).toContain('last 28 days');
        expect(answer).toMatch(/Organic Search|Paid Social|Direct|Organic Social|Email|Referral/);
        expect(answer).toContain("St. John's");
        expect(answer).toMatch(/Desktop|Mobile|Tablet/);
        expect(answer).toMatch(/\d+ visitors/);
        expect(answer).toMatch(/\d+ purchases/);
    });

    it('recommends a next promotion from the ticket path and top source', () => {
        const answer = answerMooseQuestion('What should I promote next?', aurora28);
        expect(answer).toContain('Aurora After Dark');
        expect(answer).toContain('118 purchases');
        expect(answer).toMatch(/drop in the ticket path|drop-off/);
        expect(answer).toMatch(/Organic Search|Paid Social|Direct|Organic Social|Email|Referral/);
        expect(answer).toMatch(/heads-up|focused boost/i);
    });

    it('falls back to a helpful answer that cites the visible numbers', () => {
        const answer = answerMooseQuestion('What is the meaning of life?', aurora28);
        expect(answer).toContain("I'm Moose, Tixmo's assistant");
        expect(answer).toContain('Aurora After Dark');
        expect(answer).toContain('last 28 days');
        expect(answer).toContain('1,180 visitors');
        expect(answer).toContain('2,460 page views');
        expect(answer).toContain('118 purchases');
        expect(fallbackAnswer(aurora28)).toBe(answer);

        const harbour = answerMooseQuestion('tell me a joke', harbour28);
        expect(harbour).toContain('Harbour Lights Festival');
        expect(harbour).toContain('6,840 visitors');
        expect(harbour).toContain('540 purchases');
        expect(harbour).not.toContain('1,180 visitors');
    });
});
