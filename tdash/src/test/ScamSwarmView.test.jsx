import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import api from '../lib/api';
import ScamSwarmView from '../features/scamswarm/ScamSwarmView';
import {
    bucketOf, buildScamRead, buildSeedFindings, countBuckets, describeFinding, filterFindings, groupByEvent,
    mainReason, nextStep, plainKind, reachPeople, reachWords, summarize, SEED_FINDINGS, sureness, verdictFor,
} from '../features/scamswarm/scamSwarmData';
import { answerMooseQuestion } from '../features/scamswarm/scamSwarmMooseAnswers';

vi.mock('../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const openFinding = (id) => {
    fireEvent.click(screen.getByTestId(`finding-${id}`));
    return screen.getByRole('dialog');
};
const cards = () => screen.queryAllByTestId(/^finding-ss-/);
const byId = (id) => buildSeedFindings().find((f) => f.id === id);

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

    it('sorts every finding into what needs the promoter, what is worth a look, what is handled and what is fine', () => {
        const findings = buildSeedFindings();
        const counts = countBuckets(findings);
        expect(counts).toEqual({ needs: 5, look: 4, handled: 2, fine: 3 });
        expect(counts.needs + counts.look + counts.handled + counts.fine).toBe(findings.length);
        expect(bucketOf(byId('ss-101'))).toBe('needs');
        expect(bucketOf(byId('ss-104'))).toBe('handled'); // a likely scam that is already reported
        expect(bucketOf(byId('ss-113'))).toBe('handled'); // taken down
        expect(bucketOf(byId('ss-110'))).toBe('fine');
        expect(bucketOf({ ...byId('ss-101'), whitelisted: true, verdict: 'safe', status: 'resolved' })).toBe('fine');
    });

    it('describes findings in plain words with no scores', () => {
        expect(plainKind(byId('ss-102'))).toBe('Fake login page');
        expect(plainKind(byId('ss-104'))).toBe('Fake account posing as you');
        expect(sureness(byId('ss-101'))).toEqual({ level: 5, label: 'Almost certainly a scam' });
        expect(sureness(byId('ss-107')).label).toBe('Might be a scam');
        expect(sureness(byId('ss-110')).label).toBe('Looks fine');
        expect(mainReason(byId('ss-101'))).toBe('Asks entrants for card details by DM');
        expect(mainReason(byId('ss-103'))).toBe('Barcode in the photo fails Tixmo format check');
        expect(mainReason(byId('ss-110'))).toBe('Links to the official Northlight ticket page');
        expect(describeFinding(byId('ss-103'))).toBe('fake tickets for sale on Marketplace: barcode in the photo fails Tixmo format check');
        expect(reachPeople(byId('ss-101'))).toBe(4100);
        expect(reachPeople(byId('ss-106'))).toBe(12000);
        expect(reachPeople(byId('ss-108'))).toBe(6400);
        expect(reachPeople(byId('ss-102'))).toBe(0);
        expect(reachWords(byId('ss-101'))).toBe('Could reach about 4,100 people');
        expect(reachWords(byId('ss-102'))).toBe('Shared in 9 comment threads');
    });

    it('recommends one next step per finding', () => {
        expect(nextStep(byId('ss-101'))).toEqual({ id: 'report', label: 'Report to Instagram' });
        expect(nextStep(byId('ss-102'))).toEqual({ id: 'takedown', label: 'Get it taken down' });
        expect(nextStep(byId('ss-104'))).toEqual({ id: 'waiting', label: 'Reported. Waiting on Facebook' });
        expect(nextStep(byId('ss-113'))).toEqual({ id: 'done', label: 'Taken down' });
        expect(nextStep(byId('ss-107'))).toEqual({ id: 'open', label: 'Take a look' });
        expect(nextStep(byId('ss-110'))).toBeNull();
    });

    it('groups by event with the most targeted first and has Moose speak first', () => {
        const findings = buildSeedFindings();
        const groups = groupByEvent(findings);
        expect(groups[0]).toMatchObject({ event: 'Harbour Lights Festival', needs: 2, look: 1, fine: 1, reach: 4100, poster: '/demo-assets/harbour-poster.svg' });
        expect(groups.reduce((sum, g) => sum + g.total, 0)).toBe(findings.length);
        const read = buildScamRead(findings);
        expect(read).toMatchObject({ tone: 'bad', pill: '5 scams need you', headline: '5 scams are live and could reach about 17,300 people.' });
        expect(read.lines[0]).toBe('The worst is a fake giveaway on Instagram that asks entrants for card details by DM.');
        expect(read.lines[1]).toBe('Harbour Lights Festival is the main target, with 2 of them.');
        const calm = buildScamRead(findings.map((f) => (bucketOf(f) === 'needs' ? { ...f, status: 'reported' } : f)));
        expect(calm).toMatchObject({ tone: 'watch', headline: 'Nothing dangerous is waiting on you.' });
        const clear = buildScamRead(findings.filter((f) => f.verdict === 'safe'));
        expect(clear).toMatchObject({ tone: 'good', pill: 'All clear' });
    });

    it('Moose answers from the findings without any network, in plain words', () => {
        const findings = buildSeedFindings();
        const first = answerMooseQuestion('What needs my attention first?', findings);
        expect(first).toMatch(/@northIight\.giveaways/);
        expect(first).not.toMatch(/score/i);
        expect(answerMooseQuestion('Which event is targeted the most?', findings)).toMatch(/Harbour Lights Festival is targeted the most, with 3 scams and suspicious posts still up/);
        expect(answerMooseQuestion('Which platform has the most risk?', findings)).toMatch(/Facebook has the most: 3 scams and suspicious posts are still up there/);
        expect(answerMooseQuestion('What should I tell my fans?', findings)).toMatch(/already written, and nothing goes out until you send it/);
        expect(answerMooseQuestion('banana', findings)).toMatch(/I can only talk about the ScamSwarm findings/);
    });
});

describe('ScamSwarmView', () => {
    it('opens on the verdict, Moose\'s read and only what needs the promoter', () => {
        render(<ScamSwarmView isDark />);
        expect(screen.getByRole('heading', { name: 'ScamSwarm' })).toBeInTheDocument();
        expect(screen.getByTestId('scam-verdict')).toHaveTextContent('5 scams need you');
        expect(screen.getByTestId('moose-read')).toHaveTextContent('5 scams are live and could reach about 17,300 people.');
        expect(screen.getByTestId('moose-chat')).toBeInTheDocument();
        expect(cards()).toHaveLength(5);
        expect(screen.getByTestId('bucket-needs')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('card-ss-101')).toHaveTextContent('Fake giveaway');
        expect(screen.getByTestId('card-ss-101')).toHaveTextContent('Almost certainly a scam');
        expect(screen.getByTestId('card-ss-101')).toHaveTextContent('Asks entrants for card details by DM');
        expect(screen.getByTestId('step-ss-101')).toHaveTextContent('Report to Instagram');
        expect(screen.getByTestId('step-ss-102')).toHaveTextContent('Get it taken down');
        expect(screen.queryByText(/Mock data/)).not.toBeInTheDocument();
        expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    });

    it('filters by plain buckets and by event', () => {
        render(<ScamSwarmView isDark />);
        fireEvent.click(screen.getByTestId('bucket-fine'));
        expect(cards()).toHaveLength(3);
        fireEvent.click(screen.getByTestId('bucket-all'));
        expect(cards()).toHaveLength(14);
        fireEvent.click(screen.getByTestId('event-row-Kitchen Party Social'));
        expect(cards()).toHaveLength(2);
        expect(screen.getByRole('heading', { name: 'Found for Kitchen Party Social' })).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('clear-event'));
        expect(cards()).toHaveLength(5);
        expect(within(screen.getByTestId('scamswarm-events')).getAllByRole('button')).toHaveLength(7);
    });

    it('lets Moose report every live scam in one click', () => {
        render(<ScamSwarmView isDark />);
        fireEvent.click(screen.getByTestId('report-all'));
        expect(screen.getByTestId('bulk-done')).toHaveTextContent('Done. 5 reports are with the platforms.');
        expect(screen.getByTestId('scam-verdict')).toHaveTextContent('4 worth a look');
        expect(screen.queryByTestId('report-all')).not.toBeInTheDocument();
        expect(screen.getByTestId('bucket-needs')).toHaveTextContent('0');
        expect(screen.getByTestId('bucket-handled')).toHaveTextContent('7');
        expect(screen.getByTestId('state-ss-101')).toHaveTextContent('Reported. Waiting on Instagram');
        const drawer = openFinding('ss-102');
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Takedown requested by Moose');
    });

    it('runs every action locally and never calls the API', () => {
        render(<ScamSwarmView isDark />);

        // A scam opens with its report already written; one click sends it.
        let drawer = openFinding('ss-101');
        expect(within(drawer).getByTestId('report-draft')).toHaveTextContent('@northIight.giveaways');
        expect(within(drawer).getByText('Why Moose thinks this is a scam')).toBeInTheDocument();
        expect(within(drawer).getByTestId('finding-signals')).not.toHaveTextContent('+30');
        fireEvent.click(within(drawer).getByRole('button', { name: 'Send report' }));
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Reported to Instagram');
        expect(within(drawer).getByTestId('finding-progress')).toHaveAccessibleName('Progress: Reported');

        fireEvent.click(within(drawer).getByRole('button', { name: /Warn your fans/ }));
        expect(within(drawer).getByTestId('warn-post')).toHaveTextContent('is NOT us');
        expect(within(drawer).getByTestId('warn-email')).toHaveTextContent('Official tickets are only sold at');
        fireEvent.click(within(drawer).getByRole('button', { name: /Save both as drafts/ }));
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Fan warning saved as a draft');

        fireEvent.click(within(drawer).getByRole('button', { name: /Get it taken down/ }));
        fireEvent.click(within(drawer).getByRole('button', { name: 'Send takedown request' }));
        fireEvent.click(within(drawer).getByRole('button', { name: /It is gone now/ }));
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Instagram took it down');
        expect(within(drawer).getByTestId('finding-progress')).toHaveAccessibleName('Progress: Taken down');

        fireEvent.change(within(drawer).getByLabelText('Hand this to a teammate'), { target: { value: 'hana' } });
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Handed to Hana Sato');
        expect(within(drawer).getByText(/nothing is sent or posted/)).toBeInTheDocument();
        fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

        fireEvent.click(screen.getByTestId('bucket-all'));
        drawer = openFinding('ss-108');
        fireEvent.click(within(drawer).getByRole('button', { name: /This one is fine/ }));
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('as fine');
        fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

        drawer = openFinding('ss-107');
        fireEvent.click(within(drawer).getByRole('button', { name: /Dismiss without doing anything/ }));
        expect(within(drawer).getByTestId('finding-activity')).toHaveTextContent('Dismissed');
        fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

        expect(screen.getByTestId('scam-verdict')).toHaveTextContent('4 scams need you');
        expect(screen.getByTestId('bucket-fine')).toHaveTextContent('4');
        for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
            expect(api[method]).not.toHaveBeenCalled();
        }
    });

    it('opens straight to the recommended step from a card', () => {
        render(<ScamSwarmView isDark />);
        fireEvent.click(screen.getByTestId('step-ss-102'));
        const drawer = screen.getByRole('dialog');
        expect(within(drawer).getByTestId('takedown-draft')).toHaveTextContent('northlight-tickets-login.example');
        expect(within(drawer).getByRole('heading', { name: 'Fake login page' })).toBeInTheDocument();
    });
});
