import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import api from '../lib/api';
import ScamSwarmView from '../features/scamswarm/ScamSwarmView';
import { buildSeedFindings, filterFindings, summarize, SEED_FINDINGS, verdictFor } from '../features/scamswarm/scamSwarmData';
import { answerMooseQuestion } from '../features/scamswarm/scamSwarmMooseAnswers';

vi.mock('../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const openFinding = (id) => {
    fireEvent.click(screen.getByTestId(`finding-${id}`));
    return screen.getByRole('dialog');
};

describe('ScamSwarm data', () => {
    it('scores findings into three verdicts with only fake .example links', () => {
        const findings = buildSeedFindings();
        expect(verdictFor(70)).toBe('scam');
        expect(verdictFor(69)).toBe('attention');
        expect(verdictFor(34)).toBe('safe');
        const verdicts = new Set(findings.map((f) => f.verdict));
        expect(verdicts).toEqual(new Set(['scam', 'attention', 'safe']));
        for (const finding of SEED_FINDINGS) {
            expect(new URL(finding.url).hostname.endsWith('.example')).toBe(true);
        }
        const platforms = new Set(findings.map((f) => f.platform));
        expect(platforms).toEqual(new Set(['instagram', 'facebook', 'tiktok', 'x', 'marketplace', 'web']));
        const s = summarize(findings);
        expect(s.scam + s.attention + s.safe + findings.filter((f) => f.status === 'resolved' && f.verdict !== 'safe').length).toBe(findings.length);
        expect(filterFindings(findings, { platform: 'web' }).every((f) => f.platform === 'web')).toBe(true);
    });

    it('Moose answers from the findings without any network', () => {
        const findings = buildSeedFindings();
        expect(answerMooseQuestion('What needs my attention first?', findings)).toMatch(/@northIight\.giveaways/);
        expect(answerMooseQuestion('Which event is targeted the most?', findings)).toMatch(/Harbour Lights Festival is targeted the most/);
        expect(answerMooseQuestion('Which platform has the most scams?', findings)).toMatch(/has the most likely scams/);
        expect(answerMooseQuestion('What should I tell my fans?', findings)).toMatch(/nothing gets sent/);
        expect(answerMooseQuestion('banana', findings)).toMatch(/I can only talk about the ScamSwarm findings/);
    });
});

describe('ScamSwarmView', () => {
    it('renders summary, filters, findings and Moose', () => {
        render(<ScamSwarmView isDark />);
        expect(screen.getByRole('heading', { name: /ScamSwarm/ })).toBeInTheDocument();
        expect(screen.getByTestId('kpi-scam')).toHaveTextContent('6');
        expect(screen.getByTestId('kpi-attention')).toHaveTextContent('4');
        expect(screen.getByTestId('kpi-safe')).toHaveTextContent('3');
        expect(screen.getAllByTestId(/^finding-ss-/)).toHaveLength(14);
        expect(screen.getByTestId('moose-chat')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Filter by verdict'), { target: { value: 'safe' } });
        expect(screen.getAllByTestId(/^finding-ss-/)).toHaveLength(3);
        fireEvent.change(screen.getByLabelText('Filter by verdict'), { target: { value: 'all' } });
        fireEvent.change(screen.getByLabelText('Filter by platform'), { target: { value: 'marketplace' } });
        expect(screen.getAllByTestId(/^finding-ss-/)).toHaveLength(2);
        fireEvent.change(screen.getByLabelText('Filter by platform'), { target: { value: 'all' } });
        fireEvent.change(screen.getByLabelText('Filter by event'), { target: { value: 'Kitchen Party Social' } });
        expect(screen.getAllByTestId(/^finding-ss-/)).toHaveLength(2);
    });

    it('runs every demo action locally and never calls the API', () => {
        render(<ScamSwarmView isDark />);

        let drawer = openFinding('ss-101');
        fireEvent.click(within(drawer).getByRole('button', { name: /Report to platform/ }));
        expect(within(drawer).getByTestId('report-draft')).toHaveTextContent('@northIight.giveaways');
        fireEvent.click(within(drawer).getByRole('button', { name: 'Submit report (demo)' }));
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Reported to Instagram (demo, not sent)');

        fireEvent.click(within(drawer).getByRole('button', { name: /Warn fans/ }));
        expect(within(drawer).getByTestId('warn-post')).toHaveTextContent('is NOT us');
        expect(within(drawer).getByText(/nothing is posted or emailed/)).toBeInTheDocument();
        fireEvent.click(within(drawer).getByRole('button', { name: 'Save draft (never sent)' }));

        fireEvent.click(within(drawer).getByRole('button', { name: /Request takedown/ }));
        fireEvent.click(within(drawer).getByRole('button', { name: 'Send takedown request (demo)' }));
        fireEvent.click(within(drawer).getByRole('button', { name: /Mark as taken down/ }));
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Platform confirmed the takedown');

        fireEvent.change(within(drawer).getByLabelText('Assigned to'), { target: { value: 'hana' } });
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Assigned to Hana Sato');
        fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

        drawer = openFinding('ss-110');
        fireEvent.click(within(drawer).getByRole('button', { name: /Mark as safe/ }));
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Marked safe');
        fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

        drawer = openFinding('ss-108');
        fireEvent.click(within(drawer).getByRole('button', { name: 'In review' }));
        fireEvent.click(within(drawer).getByRole('button', { name: /Dismiss/ }));
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Dismissed');
        fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

        expect(screen.getByTestId('kpi-scam')).toHaveTextContent('5');
        for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
            expect(api[method]).not.toHaveBeenCalled();
        }
    });
});
