import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IntegrationsView from '../features/IntegrationsView';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../lib/api', () => ({ default: mocks }));

const owner = { id: 'owner', role: 'OWNER', organizationId: 'org-1' };
const wrapped = (data) => ({ data: { data } });

describe('Showpass integrations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.get.mockResolvedValue(wrapped(null));
        mocks.post.mockResolvedValue(wrapped({}));
        mocks.put.mockResolvedValue(wrapped({ ticketTypeMappings: [] }));
    });

    it('shows a clear error when the Showpass key is rejected', async () => {
        mocks.post.mockRejectedValue({ response: { data: { message: 'Invalid token.' } } });
        render(<IntegrationsView isDark user={owner} />);
        fireEvent.change(screen.getByLabelText('Showpass API key'), { target: { value: 'sp_demo_revoked_key' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Showpass key' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid token.');
    });

    it('previews fixture statuses and saves ticket type mapping', async () => {
        mocks.get.mockImplementation((url) => {
            if (url.endsWith('/preview')) {
                return Promise.resolve(wrapped({
                    events: [
                        {
                            fixtureId: 'sp-evt-1543494',
                            externalItemId: '1543494',
                            name: 'Halloween at The Polygon Gallery',
                            status: 'new',
                            timezone: 'America/Vancouver',
                            ticketTypes: [{ externalTicketTypeId: '4477920', name: 'General Admission - Early Bird' }],
                        },
                        {
                            fixtureId: 'sp-evt-1545631',
                            externalItemId: '1545631',
                            name: 'Pumpkins After Dark 2026',
                            status: 'existing',
                            timezone: 'Europe/Dublin',
                            ticketTypes: [],
                        },
                        {
                            fixtureId: 'sp-evt-1563243',
                            externalItemId: '1563243',
                            name: 'MARDI GRAS 2026 — Late Show',
                            status: 'changed',
                            timezone: 'Canada/Newfoundland',
                            ticketTypes: [{ externalTicketTypeId: '4581610', name: 'General Admission - 19+ (Revised)' }],
                        },
                    ],
                }));
            }
            return Promise.resolve(wrapped({ id: 'conn', status: 'ACTIVE', keyLast4: 'lkey', lastError: null }));
        });
        render(<IntegrationsView isDark user={owner} />);
        await screen.findByText(/Key ending lkey/);
        fireEvent.click(screen.getByRole('button', { name: 'Load preview' }));
        await screen.findByText('sp-evt-1543494');
        expect(screen.getByText('new')).toBeInTheDocument();
        expect(screen.getByText('existing')).toBeInTheDocument();
        expect(screen.getByText('changed')).toBeInTheDocument();
        expect(screen.getByText('Europe/Dublin')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Tier name for 4581610'), { target: { value: 'Door' } });
        fireEvent.click(screen.getByRole('button', { name: 'Import selected events' }));
        await waitFor(() => expect(mocks.put).toHaveBeenCalledWith(
            '/organizations/org-1/showpass/config',
            expect.objectContaining({
                ticketTypeMappings: expect.arrayContaining([
                    { externalTicketTypeId: '4581610', tierName: 'Door' },
                ]),
            })
        ));
    });

    it('shows a sync failure alert for a revoked key', async () => {
        mocks.get.mockResolvedValue(wrapped({ id: 'conn', status: 'ACTIVE', keyLast4: 'lkey', lastError: null }));
        mocks.post.mockResolvedValue(wrapped({ status: 'REVOKED', lastError: 'Invalid token.' }));
        render(<IntegrationsView isDark user={owner} />);
        await screen.findByText(/Key ending lkey/);
        fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid token.');
    });
});
