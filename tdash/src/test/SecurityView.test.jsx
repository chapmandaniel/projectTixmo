import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SecurityView from '../features/security/SecurityView';
import { buildSecurityReport, buildTeamHealth, lastScanAt, relativeTime, TEAM_ROSTER } from '../features/security/securityReport';

const NOW = new Date('2026-11-16T14:47:00Z').getTime();

const reportText = (container) => container.textContent;

describe('SecurityView', () => {
    it('renders a promoter-focused healthy report with platforms, team health, devices and activity', () => {
        const { container } = render(<SecurityView isDark now={NOW} />);

        expect(screen.getByRole('heading', { name: /Security/ })).toBeInTheDocument();
        expect(screen.getByText('Your platforms look safe')).toBeInTheDocument();
        expect(screen.getByText(/Last checked \d+ min ago|Last checked just now/)).toBeInTheDocument();
        expect(screen.getByText(/Northlight Live's own event pages/)).toBeInTheDocument();
        expect(screen.getAllByText('What this means for you').length).toBeGreaterThanOrEqual(5);

        const sources = screen.getByTestId('security-sources');
        for (const id of ['website', 'account', 'checkout', 'doors']) {
            const card = within(sources).getByTestId(`security-source-${id}`);
            expect(within(card).getByText('Healthy')).toBeInTheDocument();
            expect(within(card).getByText('What this means for you')).toBeInTheDocument();
        }
        expect(screen.getByTestId('kpi-two-factor')).toHaveTextContent('19 / 19');
        expect(screen.getByText('Event pages online').parentElement.parentElement).toHaveTextContent('19 / 19');
        expect(within(screen.getByTestId('security-feed')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(10);
        expect(screen.getAllByTestId(/security-device-/)).toHaveLength(14);

        const copy = reportText(container);
        expect(copy).not.toMatch(/across Tixmo/i);
        expect(copy).not.toMatch(/Log events analyzed/i);
        expect(copy).not.toMatch(/Time to detect/i);
        expect(copy).not.toMatch(/Infrastructure/i);
        expect(copy).not.toMatch(/log pipeline/i);
        expect(copy).not.toMatch(/database backup/i);
        expect(copy).not.toMatch(/port scan/i);
        expect(copy).not.toMatch(/password123|hunter2|p@ssw0rd/i);
    });

    it('shows Team Account Health with per-member rows, agreed 2FA counts, and demo next-step actions', () => {
        render(<SecurityView isDark now={NOW} />);

        const health = screen.getByTestId('team-account-health');
        expect(screen.getByRole('heading', { name: 'Team Account Health' })).toBeInTheDocument();
        expect(health).toHaveTextContent(/checked against known breach lists/i);

        const summary = within(health).getByTestId('team-health-summary');
        expect(summary).toHaveTextContent('19 / 19');
        expect(summary).toHaveTextContent('3 pending invites have not set up 2FA yet');
        expect(summary).toHaveTextContent('2');
        expect(summary).toHaveTextContent('Liam Byrne and Sean Power');
        expect(summary).toHaveTextContent('0 current');
        expect(summary).toHaveTextContent('1 already reset (Marcus Bell)');

        const roster = within(health).getByTestId('team-health-roster');
        expect(within(roster).getAllByRole('listitem')).toHaveLength(TEAM_ROSTER.length);

        for (const id of ['liam', 'sean']) {
            const row = within(health).getByTestId(`team-health-${id}`);
            expect(row).toHaveTextContent('Password looks weak');
            expect(row).toHaveTextContent('Action recommended');
            expect(row).toHaveTextContent('Ask them to choose a longer, less common password.');
            expect(within(row).getByRole('button', { name: 'Send reminder' })).toBeInTheDocument();
        }

        const marcus = within(health).getByTestId('team-health-marcus');
        expect(marcus).toHaveTextContent('Match already reset');
        expect(marcus).toHaveTextContent('Already reset. No further action needed.');
        expect(within(marcus).queryByRole('button')).not.toBeInTheDocument();

        for (const id of ['chloe', 'ethan', 'ben']) {
            const row = within(health).getByTestId(`team-health-${id}`);
            expect(row).toHaveTextContent('2FA not set up yet');
            expect(row).toHaveTextContent('Invite pending');
            expect(row).toHaveTextContent('They will set up 2FA when they accept the invite.');
            expect(within(row).getByRole('button', { name: 'Resend invite' })).toBeInTheDocument();
        }

        const avery = within(health).getByTestId('team-health-avery');
        expect(avery).toHaveTextContent('2FA is on');
        expect(avery).toHaveTextContent('Password looks strong');
        expect(avery).toHaveTextContent('Not on known breach lists');

        // KPI two-factor number matches the team-health segment.
        expect(screen.getByTestId('kpi-two-factor')).toHaveTextContent('19 / 19');

        fireEvent.click(within(within(health).getByTestId('team-health-liam')).getByRole('button', { name: 'Send reminder' }));
        expect(within(health).getByRole('button', { name: 'Send reminder sent (demo)' })).toBeDisabled();
    });

    it('keeps the last check within five minutes of now and the team-health numbers stable and fake', () => {
        const report = buildSecurityReport(NOW);
        const team = buildTeamHealth(NOW);
        expect(NOW - report.scannedAt.getTime()).toBeLessThanOrEqual(5 * 60 * 1000);
        expect(report.status).toBe('healthy');
        expect(report.sources.map((s) => s.id)).toEqual(['website', 'account', 'checkout', 'doors']);
        expect(report.sources.every((s) => s.health === 'healthy')).toBe(true);
        expect(report.totals.twoFactorOn).toBe(19);
        expect(report.totals.activeMembers).toBe(19);
        expect(report.totals.pendingInvites).toBe(3);
        expect(report.totals.twoFactorOn).toBe(team.totals.twoFactorOn);
        expect(team.totals.weakPasswords).toBe(2);
        expect(team.totals.leakResolved).toBe(1);
        expect(team.totals.leakCurrent).toBe(0);
        expect(team.totals.withoutTwoFactor).toBe(3);
        expect(team.pendingNames).toEqual(['Chloe Dubois', 'Ethan Clarke', 'Ben Abbott']);
        expect(team.weakNames).toEqual(['Liam Byrne', 'Sean Power']);
        expect(team.leakResolvedNames).toEqual(['Marcus Bell']);
        expect(team.members).toHaveLength(22);
        expect(report.devices).toHaveLength(14);
        expect(buildSecurityReport(NOW).totals).toEqual(report.totals);
        expect(lastScanAt(NOW).getTime()).toBeLessThanOrEqual(NOW);
        expect(relativeTime(NOW - 3 * 60 * 1000, NOW)).toBe('3 min ago');
        expect(JSON.stringify(team)).not.toMatch(/passwordHash|\$2[aby]\$|hunter2|password123/i);
    });
});
