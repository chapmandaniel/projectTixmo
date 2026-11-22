import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SecurityView from '../features/security/SecurityView';
import { buildSecurityReport, buildTeamHealth, DOC_IP_RANGES, lastScanAt, PROTECTION_LAYER_DEFS, relativeTime, TEAM_ROSTER } from '../features/security/securityReport';
import { LAYER_INFO, areaTone, attackInfo } from '../features/security/securityAreas';

const NOW = new Date('2026-11-16T14:47:00Z').getTime();

const reportText = (container) => container.textContent;

describe('SecurityView', () => {
    it('renders a promoter-focused healthy report with platforms, team health, devices and activity', () => {
        const { container } = render(<SecurityView isDark now={NOW} />);

        expect(screen.getByRole('heading', { name: /Security/ })).toBeInTheDocument();
        expect(screen.getByText('Your platforms look safe')).toBeInTheDocument();
        expect(screen.getAllByText(/Last checked \d+ min ago|Last checked just now/).length).toBeGreaterThanOrEqual(1);
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
        expect(screen.getByTestId('security-home-hero')).toHaveClass('lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]');
        expect(screen.getByTestId('security-hero-summary')).toBeInTheDocument();
        expect(screen.getByTestId('moose-chat')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Moose' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Is my account safe right now?' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'What attacks did we stop this week?' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Who on my team needs to fix their password or 2FA?' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'What protects my event pages?' })).toBeInTheDocument();
        expect(screen.getByLabelText('Ask Moose about these numbers')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Protection Layers' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Suspected Attacks' })).toBeInTheDocument();
        const website = within(sources).getByTestId('security-source-website');
        expect(website).not.toHaveTextContent('Bot and scalper-like traffic filtered before it reaches buyers');
        expect(website).toHaveTextContent('see Suspected Attacks and Protection Layers');

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

    it('tells the parts of the page apart: one colour per area, and green or amber only for status', () => {
        render(<SecurityView isDark now={NOW} />);

        // The only accent line belongs to the page header; cards and sections draw none.
        expect(screen.getAllByTestId('title-accent-strip')).toHaveLength(1);
        expect(screen.queryAllByTestId('surface-accent')).toHaveLength(0);

        // Each platform keeps its own colour, and none of them borrows a status colour.
        const sources = screen.getByTestId('security-sources');
        const badgeClasses = ['website', 'account', 'checkout', 'doors'].map((id) => {
            const card = within(sources).getByTestId(`security-source-${id}`);
            const badge = card.querySelector('span[aria-hidden="true"]');
            expect(badge.className).toContain(areaTone(id, true).badge);
            return areaTone(id, true).badge;
        });
        expect(new Set(badgeClasses).size).toBe(4);
        for (const id of ['website', 'account', 'checkout', 'doors', 'data']) {
            for (const theme of [true, false]) {
                expect(Object.values(areaTone(id, theme)).join(' ')).not.toMatch(/emerald|green|amber|yellow|red|rose/);
            }
        }

        // Protection layers are grouped by what they look after, in plain words first.
        const layers = screen.getByTestId('protection-layers');
        const pages = within(layers).getByTestId('protection-group-website');
        expect(pages).toHaveTextContent('Event pages');
        for (const id of ['waf', 'ddos', 'bots', 'tls']) {
            expect(within(pages).getByTestId(`protection-layer-${id}`)).toBeInTheDocument();
        }
        expect(within(layers).getByTestId('protection-layer-waf')).toHaveTextContent('Blocks break-in attempts on your pages');
        expect(within(layers).getByTestId('protection-layer-waf')).toHaveTextContent('Web application firewall (WAF)');
        expect(within(within(layers).getByTestId('protection-group-checkout')).getByTestId('protection-layer-fraud')).toBeInTheDocument();
        expect(Object.keys(LAYER_INFO).sort()).toEqual(PROTECTION_LAYER_DEFS.map((layer) => layer.id).sort());

        // Attacks lead with what happened; the technical name stays on the row.
        const firstAttack = within(screen.getByTestId('suspected-attacks-list')).getAllByRole('listitem')[0];
        expect(firstAttack).toHaveTextContent('Someone tried stolen passwords on your team sign-in');
        expect(firstAttack).toHaveTextContent('Credential stuffing');
        for (const item of buildSecurityReport(NOW).attacks.items) {
            expect(attackInfo(item.kind).plain).not.toBe(item.kind);
        }

        // Amber is kept for the two people with something to do, and they come first.
        const rows = within(screen.getByTestId('team-health-roster')).getAllByRole('listitem');
        expect(rows.slice(0, 2).map((row) => row.getAttribute('data-testid'))).toEqual(['team-health-liam', 'team-health-sean']);
        const amberRows = rows.filter((row) => /amber/.test(row.className));
        expect(amberRows.map((row) => row.getAttribute('data-testid'))).toEqual(['team-health-liam', 'team-health-sean']);
        expect(screen.getByTestId('team-health-avery')).not.toHaveTextContent('Action recommended');
        expect(screen.getByTestId('team-health-avery')).not.toHaveTextContent('All clear');

        // A device paused on purpose is labelled, not flagged as a problem.
        expect(screen.getByTestId('security-device-signal')).toHaveTextContent('Paused');
        expect(screen.getByTestId('security-device-signal').className).not.toMatch(/amber/);
        expect(screen.getByTestId('security-device-lost-ipad')).toHaveTextContent('Revoked');
    });

    it('reads the verdict first and lets the activity feed be narrowed to one area', () => {
        render(<SecurityView isDark now={NOW} />);

        const summary = screen.getByTestId('security-hero-summary');
        expect(summary).toHaveTextContent('Nothing here needs urgent attention.');
        const report = buildSecurityReport(NOW);
        expect(report.meaning).toBe([report.meaningHeadline, ...report.meaningPoints.map((point) => point.text)].join(' '));
        expect(report.meaning).toContain('Two teammates are recommended to choose a stronger password');
        expect(within(summary).getByRole('button', { name: 'See who' })).toBeInTheDocument();
        // The verdict comes before the four tiles.
        expect(
            screen.getByText('Nothing here needs urgent attention.').compareDocumentPosition(screen.getByText('Event pages online'))
            & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();

        const feed = screen.getByTestId('security-feed');
        const total = within(feed).getAllByRole('listitem').length;
        expect(total).toBe(report.feed.length);
        // Routine "all clear" rows stay quiet; only the notable ones carry a label.
        expect(within(feed).queryByText('All clear')).not.toBeInTheDocument();
        expect(within(feed).getAllByText('Protected').length).toBe(report.feed.filter((item) => item.tone === 'protected').length);

        fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
        const checkoutRows = within(feed).getAllByRole('listitem');
        expect(checkoutRows).toHaveLength(report.feed.filter((item) => item.source === 'checkout').length);
        expect(checkoutRows.length).toBeLessThan(total);
        expect(screen.getByRole('button', { name: 'Checkout' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'All' }));
        expect(within(feed).getAllByRole('listitem')).toHaveLength(total);
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

    it('answers a suggested Moose question from the security report on the page', () => {
        render(<SecurityView isDark now={NOW} />);
        fireEvent.click(screen.getByRole('button', { name: 'Who on my team needs to fix their password or 2FA?' }));
        const replies = screen.getAllByTestId('moose-message-moose');
        expect(replies.at(-1)).toHaveTextContent('Liam Byrne and Sean Power');
        expect(replies.at(-1)).toHaveTextContent('Chloe Dubois, Ethan Clarke, and Ben Abbott');
        expect(replies.at(-1)).toHaveTextContent('Marcus Bell');
    });

    it('shows protection layers as active and a reassuring suspected-attacks timeline with documentation IP ranges only', () => {

        render(<SecurityView isDark now={NOW} />);

        const layers = screen.getByTestId('protection-layers');
        const layerIds = ['waf', 'ddos', 'bots', 'rate', 'tls', 'fraud', 'login', 'breach', 'backups'];
        expect(layerIds).toHaveLength(9);
        for (const id of layerIds) {
            const card = within(layers).getByTestId(`protection-layer-${id}`);
            expect(within(card).getByText('Active / Healthy')).toBeInTheDocument();
            expect(within(card).getByText(/Last checked \d+ min ago|Last checked just now/)).toBeInTheDocument();
        }

        const attacks = screen.getByTestId('suspected-attacks');
        const summary = within(attacks).getByTestId('suspected-attacks-summary');
        expect(summary).toHaveTextContent('14');
        expect(summary).toHaveTextContent('61');
        expect(summary).toHaveTextContent('214');
        expect(summary).toHaveTextContent('0 breached');
        expect(attacks).toHaveTextContent('Nothing was breached');

        const list = within(attacks).getByTestId('suspected-attacks-list');
        const rows = within(list).getAllByRole('listitem');
        expect(rows.length).toBeGreaterThanOrEqual(5);
        const kinds = rows.map((row) => row.textContent);
        expect(kinds.some((text) => /Credential stuffing/i.test(text))).toBe(true);
        expect(kinds.some((text) => /Scalper bot burst/i.test(text))).toBe(true);
        expect(kinds.some((text) => /Card-testing/i.test(text))).toBe(true);
        expect(kinds.some((text) => /Request flood/i.test(text))).toBe(true);
        expect(kinds.some((text) => /SQL or script injection probe/i.test(text))).toBe(true);

        const report = buildSecurityReport(NOW);
        expect(report.protection.layers).toHaveLength(9);
        expect(report.protection.allActive).toBe(true);
        expect(report.attacks.totals).toEqual({ last24h: 14, last7d: 61, last30d: 214, visible24h: report.attacks.totals.visible24h, breached: 0, reached: 0 });
        expect(report.attacks.totals.last24h).toBeLessThan(report.attacks.totals.last7d);
        expect(report.attacks.totals.last7d).toBeLessThan(report.attacks.totals.last30d);
        for (const item of report.attacks.items) {
            expect(DOC_IP_RANGES).toContain(item.range);
            expect(['Blocked', 'Mitigated']).toContain(item.status);
            expect(item.country).toBeTruthy();
            expect(item.target).toBeTruthy();
        }
        const blob = JSON.stringify(report.attacks);
        const ips = blob.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
        for (const ip of ips) {
            expect(['192.0.2', '198.51.100', '203.0.113']).toContain(ip.split('.').slice(0, 3).join('.'));
        }
        expect(blob).not.toMatch(/\b(?!192\.0\.2|198\.51\.100|203\.0\.113)(?:\d{1,3}\.){3}\d{1,3}\b/);
    });
});
