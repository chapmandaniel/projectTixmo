import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildWorkspace } from '../features/social/mockWorkspace';
import SocialCommandCenter from '../features/social/SocialCommandCenter';
import api from '../lib/api';

vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
    },
}));

const enabledConfig = {
    success: true,
    data: {
        enabled: true,
        // Default screenshot/unit path uses mocks until ready is true.
        ready: false,
        phase: 'mock',
        environment: 'sandbox',
        sandboxOnly: true,
        retentionDays: 14,
        emailCapture: true,
        poll: {
            intervalMs: 5 * 60 * 1000,
            eventDayIntervalMs: 60 * 1000,
            lookbackMs: 14 * 24 * 60 * 60 * 1000,
            eventDayLookbackMs: 48 * 60 * 60 * 1000,
        },
    },
};

const owner = { firstName: 'Avery', lastName: 'Stone', role: 'OWNER', email: 'avery@festival.test' };

const renderSocial = (entry) => render(
    <MemoryRouter initialEntries={[entry]}>
        <Routes>
            <Route path="/social/*" element={<SocialCommandCenter isDark user={owner} />} />
        </Routes>
    </MemoryRouter>
);

const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
});

describe('Social Command Center', () => {
    beforeEach(() => {
        api.get.mockReset();
        api.get.mockResolvedValue({ data: enabledConfig });
    });

    it('fails closed to the placeholder when the flag is not exactly true', async () => {
        api.get.mockResolvedValue({ data: { success: true, data: { enabled: false } } });
        renderSocial('/social');
        expect(await screen.findByText('Outside V1 beta')).toBeInTheDocument();
        expect(screen.queryByTestId('social-command-center')).not.toBeInTheDocument();
    });

    it('keeps event, date range, and account in the URL across tabs', async () => {
        renderSocial('/social?tab=overview&event=harbourfest-2027&range=30d&account=instagram&from=2027-07-01&to=2027-07-10');
        const page = await screen.findByTestId('social-command-center');
        expect(page).toHaveAttribute('data-query', expect.stringContaining('event=harbourfest-2027'));
        expect(page).toHaveAttribute('data-query', expect.stringContaining('range=30d'));
        expect(page).toHaveAttribute('data-query', expect.stringContaining('account=instagram'));
        fireEvent.click(screen.getByRole('link', { name: 'Issues' }));
        expect(page).toHaveAttribute('data-query', expect.stringContaining('tab=issues'));
        expect(page).toHaveAttribute('data-query', expect.stringContaining('event=harbourfest-2027'));
        expect(page).toHaveAttribute('data-query', expect.stringContaining('range=30d'));
        expect(page).toHaveAttribute('data-query', expect.stringContaining('account=instagram'));
        fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'quiet-hall' } });
        expect(page).toHaveAttribute('data-query', expect.stringContaining('event=quiet-hall'));
        expect(screen.getByLabelText('Date range')).toHaveValue('30d');
        expect(screen.getByLabelText('Account')).toHaveValue('instagram');
    });

    it('shows empty and error states as text, with reply links that only leave the dashboard', async () => {
        let view = renderSocial('/social?scene=no-accounts');
        expect(await screen.findByText('No sandbox Page connected')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Connect sandbox Page' })).toBeInTheDocument();
        expect(screen.getAllByText('SANDBOX · test data').length).toBeGreaterThan(0);
        view.unmount();

        view = renderSocial('/social?scene=token-expired');
        expect(await screen.findByText(/sandbox token expired/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reconnect sandbox Page' })).toBeInTheDocument();
        view.unmount();

        view = renderSocial('/social?scene=missing-permission');
        expect(await screen.findByText(/no insights access/)).toBeInTheDocument();
        view.unmount();

        view = renderSocial('/social?scene=rate-limited');
        expect(await screen.findByText(/Retrying at 4:30 PM NDT/)).toBeInTheDocument();
        view.unmount();

        view = renderSocial('/social?graphError=4');
        expect(await screen.findByText(/Graph code 4/)).toBeInTheDocument();
        expect(screen.getByTestId('social-command-center')).toHaveAttribute('data-graph-error', '4');
        view.unmount();

        view = renderSocial('/social?graphError=17');
        expect(await screen.findByText(/Graph code 17/)).toBeInTheDocument();
        view.unmount();

        view = renderSocial('/social?graphError=32');
        expect(await screen.findByText(/Graph code 32/)).toBeInTheDocument();
        view.unmount();

        view = renderSocial('/social?scene=insights-pending');
        expect((await screen.findAllByText('Insights pending')).length).toBeGreaterThan(0);
        expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
        view.unmount();

        view = renderSocial('/social?scene=syncing');
        expect(await screen.findAllByText('—')).not.toHaveLength(0);
        expect(screen.getAllByText('Syncing').length).toBeGreaterThan(0);
        expect(screen.getByTestId('sync-progress')).toHaveTextContent(/Posts ✓/);
        expect(screen.queryByText(/Ticketing spike/)).not.toBeInTheDocument();
        expect(screen.queryByText(/need action/)).not.toBeInTheDocument();
        view.unmount();

        view = renderSocial('/social?scene=no-data&tab=posts');
        expect(await screen.findByText('No data in this range')).toBeInTheDocument();
        view.unmount();

        view = renderSocial('/social?scene=no-issues&tab=issues');
        expect(await screen.findByText('Nothing needs action')).toBeInTheDocument();
        view.unmount();

        view = renderSocial('/social?scene=no-schedule&tab=settings');
        expect((await screen.findAllByText(/No schedule dates/)).length).toBeGreaterThan(0);
        expect(screen.getByText(/ON-SALE DAY does not trigger/)).toBeInTheDocument();
        expect(screen.queryByText(/Harbourfest 2027: EVENT DAY/)).not.toBeInTheDocument();
        view.unmount();

        renderSocial('/social/posts/post-fb-1?tab=posts');
        const reply = (await screen.findAllByRole('link', { name: 'Reply on Facebook ↗' }))[0];
        expect(reply).toHaveAttribute('target', '_blank');
        expect(reply).toHaveAttribute('rel', 'noreferrer');
        expect(reply.getAttribute('href')).toContain('https://');
        expect(screen.queryByRole('button', { name: 'Post' })).not.toBeInTheDocument();
        expect(screen.getAllByTestId('classifier-label-slot')[0]).toHaveAttribute('hidden');
        expect(screen.getByTestId('classifier-label-filter').closest('label')).toHaveAttribute('hidden');
    });

    it('plans a poll and does not start one', async () => {
        renderSocial('/social?tab=settings');
        const plan = await screen.findByTestId('poll-plan');
        expect(plan).toHaveAttribute('data-running', 'false');
        expect(plan).toHaveAttribute('data-interval', '60000');
        const stamps = plan.getAttribute('data-polls').split(',');
        expect(Date.parse(stamps[1]) - Date.parse(stamps[0])).toBe(60 * 1000);
        expect(screen.getByText(/Phase 1 does not poll/)).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Hold EVENT DAY' })).toBeInTheDocument();
        expect(screen.queryByRole('radio', { name: /TIGHT/ })).not.toBeInTheDocument();
        expect(screen.getAllByText(/SANDBOX · test data/).length).toBeGreaterThan(0);
        expect(screen.getByTestId('thresholds')).toHaveTextContent('3.0×');
        expect(screen.getByRole('button', { name: 'Edit thresholds' })).toBeInTheDocument();
    });

    it('shows the overview strip, issue workflow, and sandbox connect steps', async () => {
        const view = renderSocial('/social?tab=overview&event=harbourfest-2027');
        expect(await screen.findByTestId('alert-strip')).toHaveTextContent(/Ticketing wave/);
        expect(screen.getByTestId('top-posts')).toHaveTextContent('Lineup drop');
        expect(screen.getByTestId('mode-line')).toHaveTextContent(/auto from event dates/);
        expect(screen.getByRole('link', { name: 'Change' })).toBeInTheDocument();
        view.unmount();

        renderSocial('/social?tab=issues&view=handled&account=all');
        expect(await screen.findByText('[HANDLED]')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });

    it('keeps commenter copy off the page and the social module off the network', async () => {
        renderSocial('/social?tab=issues');
        const page = await screen.findByTestId('social-command-center');
        const text = within(page).getByText(/Safety keyword/).textContent;
        expect(`${page.textContent} ${text}`.toLowerCase()).not.toMatch(/customer|buyer|ticket holder/);
        const root = path.resolve(__dirname, '../features/social');
        const source = walk(root).filter((file) => file.endsWith('.js') || file.endsWith('.jsx')).map((file) => readFileSync(file, 'utf8')).join('\n');
        expect(source).not.toMatch(/setInterval|openrouter|fetch\(|customer|buyer|ticket holder/i);
    });

    it('loads the live workspace when no scene is requested and writes issue edits to the API', async () => {
        const live = { ...buildWorkspace('ready'), workspaceMarker: 'live' };
        live.events = [{ id: 'live-event', name: 'Live Event', mode: 'NORMAL', modeLabel: 'NORMAL', onSale: true, scheduled: true }];
        const readyConfig = {
            success: true,
            data: { ...enabledConfig.data, ready: true, phase: 'data' },
        };
        api.get.mockImplementation((url) => Promise.resolve({
            data: url === '/social/workspace' ? { success: true, data: live } : readyConfig,
        }));
        api.patch.mockResolvedValue({ data: { success: true, data: {} } });
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
        renderSocial('/social?tab=issues&event=live-event&view=all');
        expect(await screen.findByRole('option', { name: 'Live Event' })).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/social/workspace', expect.objectContaining({
            suppressGlobalError: true,
            params: expect.objectContaining({ event: 'live-event', range: '7d' }),
        }));
        fireEvent.click(screen.getAllByRole('link', { name: /Ticketing/ })[0]);
        fireEvent.click(await screen.findByRole('button', { name: 'Mark handled' }));
        await screen.findByText(/Marked handled by Avery Stone/);
        expect(api.patch).toHaveBeenCalledWith(expect.stringMatching(/^\/social\/issues\//), { status: 'HANDLED' }, { suppressGlobalError: true });
    });

    it('keeps scene mocks off the live endpoint', async () => {
        renderSocial('/social?scene=no-data&tab=posts');
        await screen.findByText('No data in this range');
        expect(api.get).not.toHaveBeenCalledWith('/social/workspace', expect.anything());
    });
});
