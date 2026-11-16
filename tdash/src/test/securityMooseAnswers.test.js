import { describe, expect, it } from 'vitest';
import { buildSecurityReport } from '../features/security/securityReport';
import {
    SUGGESTED_QUESTIONS,
    answerMooseQuestion,
    fallbackAnswer,
    joinNames,
} from '../features/security/securityMooseAnswers';

const NOW = new Date('2026-11-16T14:47:00Z').getTime();
const report = buildSecurityReport(NOW);

const withTotals = (overrides) => ({
    ...report,
    attacks: { ...report.attacks, totals: { ...report.attacks.totals, ...(overrides.attacks || {}) } },
    team: { ...report.team, totals: { ...report.team.totals, ...(overrides.team || {}) }, ...(overrides.teamNames || {}) },
    totals: { ...report.totals, ...(overrides.totals || {}) },
    protection: {
        ...report.protection,
        layers: overrides.layers || report.protection.layers,
        allActive: overrides.allActive ?? report.protection.allActive,
    },
});

describe('Security Moose answer engine', () => {
    it('exposes the four suggested questions and joins names plainly', () => {
        expect(SUGGESTED_QUESTIONS).toEqual([
            'Is my account safe right now?',
            'What attacks did we stop this week?',
            'Who on my team needs to fix their password or 2FA?',
            'What protects my event pages?',
        ]);
        expect(joinNames(['Liam Byrne', 'Sean Power'])).toBe('Liam Byrne and Sean Power');
        expect(joinNames(['Chloe Dubois', 'Ethan Clarke', 'Ben Abbott'])).toBe('Chloe Dubois, Ethan Clarke, and Ben Abbott');
    });

    it('says the account is safe using the report totals, not hardcoded figures', () => {
        const answer = answerMooseQuestion('Is my account safe right now?', report);
        expect(answer).toContain(`${report.totals.pagesOnline} of ${report.totals.pagesTotal} event pages are online`);
        expect(answer).toContain(`${report.team.totals.twoFactorOn} of ${report.team.totals.active} active members use two-factor sign-in`);
        expect(answer).toContain(`${report.attacks.totals.last24h} suspected attacks were stopped automatically`);
        expect(answer).toContain(`${report.attacks.totals.breached} were breached`);
        expect(answer).toContain(report.team.leakResolvedNames[0]);

        const tweaked = withTotals({
            attacks: { last24h: 99, breached: 0, reached: 0 },
            totals: { pagesOnline: 7, pagesTotal: 7 },
        });
        const changed = answerMooseQuestion('Is my account safe right now?', tweaked);
        expect(changed).toContain('7 of 7 event pages are online');
        expect(changed).toContain('99 suspected attacks were stopped automatically');
        expect(changed).not.toContain(`${report.attacks.totals.last24h} suspected attacks were stopped automatically`);
    });

    it('summarizes attacks this week from the 7-day total and listed kinds', () => {
        const answer = answerMooseQuestion('What attacks did we stop this week?', report);
        expect(answer).toContain(`we stopped ${report.attacks.totals.last7d} suspected attacks`);
        expect(answer).toContain(`${report.attacks.totals.last24h} in the last 24 hours`);
        expect(answer).toContain(`${report.attacks.totals.last30d} over the last 30 days`);
        expect(answer).toMatch(/credential stuffing/i);
        expect(answer).toMatch(/scalper bot burst/i);
        expect(answer).toMatch(/card-testing/i);
        expect(answer).toMatch(/request flood/i);
        expect(answer).toContain(`${report.attacks.totals.breached} were breached`);

        const tweaked = withTotals({ attacks: { last7d: 321, last24h: 12, last30d: 900, breached: 0, reached: 0 } });
        const changed = answerMooseQuestion('What attacks did we stop this week?', tweaked);
        expect(changed).toContain('we stopped 321 suspected attacks');
        expect(changed).not.toContain(`we stopped ${report.attacks.totals.last7d} suspected attacks`);
    });

    it('names the teammates who need a password or 2FA follow-up', () => {
        const answer = answerMooseQuestion('Who on my team needs to fix their password or 2FA?', report);
        expect(answer).toContain(joinNames(report.team.weakNames));
        expect(answer).toContain('weak password');
        expect(answer).toContain(joinNames(report.team.pendingNames));
        expect(answer).toContain('not set up 2FA yet');
        expect(answer).toContain(joinNames(report.team.leakResolvedNames));
        expect(answer).toContain('already reset');
        expect(answer).toContain(`${report.team.totals.twoFactorOn} of ${report.team.totals.active} active members already use two-factor sign-in`);
        expect(answer).toContain(`${report.team.totals.leakCurrent} current breach-list matches`);

        const tweaked = withTotals({
            team: { weakPasswords: 1, withoutTwoFactor: 1, leakResolved: 0, leakCurrent: 0, twoFactorOn: 10, active: 10, roster: 11 },
            teamNames: { weakNames: ['Ada West'], pendingNames: ['Ben Abel'], leakResolvedNames: [] },
        });
        const changed = answerMooseQuestion('Who on my team needs to fix their password or 2FA?', tweaked);
        expect(changed).toContain('Ada West has a weak password');
        expect(changed).toContain('Ben Abel has not set up 2FA yet');
        expect(changed).not.toContain('Liam Byrne');
        expect(changed).not.toContain('Marcus Bell');
    });

    it('lists protection layers from the report', () => {
        const answer = answerMooseQuestion('What protects my event pages?', report);
        expect(answer).toContain(`${report.protection.layers.length} protection layers`);
        expect(answer).toContain(report.protection.layers[0].status.toLowerCase());
        report.protection.layers.forEach((layer) => {
            expect(answer).toContain(layer.name);
        });
        expect(answer).toContain(`${report.totals.pagesOnline} of ${report.totals.pagesTotal} online`);

        const tweaked = withTotals({
            layers: [
                { id: 'waf', name: 'Test Firewall', status: 'Active / Healthy' },
                { id: 'tls', name: 'Test Encryption', status: 'Active / Healthy' },
            ],
            totals: { pagesOnline: 3, pagesTotal: 3 },
        });
        const changed = answerMooseQuestion('What protects my event pages?', { ...tweaked, protection: { ...tweaked.protection, allActive: true } });
        expect(changed).toContain('2 protection layers');
        expect(changed).toContain('Test Firewall and Test Encryption');
        expect(changed).not.toContain('Bot and scalper defense');
    });

    it('falls back to a helpful summary that still cites the visible numbers', () => {
        const answer = answerMooseQuestion('What is the meaning of life?', report);
        expect(answer).toContain("I'm Moose, Tixmo's assistant");
        expect(answer).toContain(`${report.attacks.totals.last24h} / ${report.attacks.totals.last7d} / ${report.attacks.totals.last30d}`);
        expect(answer).toContain(`${report.team.totals.weakPasswords} teammates have a weak password`);
        expect(answer).toContain(`${report.team.totals.withoutTwoFactor} pending invites have not set up 2FA yet`);
        expect(answer).toContain(`${report.team.totals.leakResolved} earlier breach-list match is already reset`);
        expect(answer).toBe(fallbackAnswer(report));

        const tweaked = withTotals({ attacks: { last24h: 4, last7d: 8, last30d: 16, breached: 0 } });
        const changed = answerMooseQuestion('tell me a joke', tweaked);
        expect(changed).toContain('4 / 8 / 16');
        expect(changed).not.toContain(`${report.attacks.totals.last24h} / ${report.attacks.totals.last7d} / ${report.attacks.totals.last30d}`);
    });
});
