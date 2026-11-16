import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import SecurityView from '../features/security/SecurityView';
import { buildSecurityReport, lastScanAt, relativeTime } from '../features/security/securityReport';

const NOW = new Date('2026-11-15T23:47:00Z').getTime();

describe('SecurityView', () => {
    it('renders the healthy report with every log source, counts and the activity feed', () => {
        render(<SecurityView isDark now={NOW} />);

        expect(screen.getByRole('heading', { name: /Security/ })).toBeInTheDocument();
        expect(screen.getByText('All systems healthy')).toBeInTheDocument();
        expect(screen.getByText(/Last scanned \d+ min ago|Last scanned just now/)).toBeInTheDocument();

        const sources = screen.getByTestId('security-sources');
        for (const id of ['auth', 'api', 'payments', 'admin', 'door', 'infra']) {
            const card = within(sources).getByTestId(`security-source-${id}`);
            expect(within(card).getByText('Healthy')).toBeInTheDocument();
            expect(within(card).getByText('Events analyzed')).toBeInTheDocument();
            expect(within(card).getByText('Threats blocked')).toBeInTheDocument();
        }
        expect(screen.getByText('6 / 6')).toBeInTheDocument();
        expect(within(screen.getByTestId('security-feed')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(10);
    });

    it('keeps the last scan within five minutes of now and the numbers small and stable', () => {
        const report = buildSecurityReport(NOW);
        expect(NOW - report.scannedAt.getTime()).toBeLessThanOrEqual(5 * 60 * 1000);
        expect(report.totals.blocked).toBeLessThan(60);
        expect(report.totals.events).toBeGreaterThan(100000);
        expect(report.sources.every((s) => s.health === 'healthy')).toBe(true);
        expect(buildSecurityReport(NOW).totals).toEqual(report.totals);
        expect(lastScanAt(NOW).getTime()).toBeLessThanOrEqual(NOW);
        expect(relativeTime(NOW - 3 * 60 * 1000, NOW)).toBe('3 min ago');
    });
});
