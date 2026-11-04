import React, { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { fireEvent, render, screen } from '@testing-library/react';
import GlobalErrorNotification from '../components/GlobalErrorNotification';

const owner = { id: 'owner', role: 'OWNER', organizationId: 'org-1' };

const Harness = ({ View }) => {
    const [globalError, setGlobalError] = useState(null);
    useEffect(() => {
        const handleGlobalError = (event) => {
            const error = event.detail;
            if (error?.status !== 401) {
                setGlobalError({
                    message: error?.message || 'An unexpected system error occurred.',
                    code: error?.status || 'UNKNOWN',
                });
            }
        };
        const clearGlobalError = () => setGlobalError(null);
        window.addEventListener('tixmo:global-error', handleGlobalError);
        window.addEventListener('tixmo:global-error-clear', clearGlobalError);
        return () => {
            window.removeEventListener('tixmo:global-error', handleGlobalError);
            window.removeEventListener('tixmo:global-error-clear', clearGlobalError);
        };
    }, []);
    return (
        <>
            <GlobalErrorNotification error={globalError} onClose={() => setGlobalError(null)} />
            <View isDark user={owner} />
        </>
    );
};

const loadShowpassClient = async (adapter) => {
    vi.resetModules();
    const create = axios.create.bind(axios);
    vi.spyOn(axios, 'create').mockImplementation((config) => create({ ...config, adapter }));
    const View = (await import('../features/IntegrationsView')).default;
    const api = (await import('../lib/api')).default;
    return { View, api };
};

describe('Showpass connect global errors', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
    });

    it('keeps a handled 400 inline and shows no global toast after connect succeeds', async () => {
        const adapter = vi.fn((config) => {
            const url = String(config.url || '');
            if (config.method === 'post' && url.includes('/connection')) {
                const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                if (body.apiKey === 'sp_demo_revoked_key') {
                    return Promise.reject({
                        config,
                        response: { status: 400, data: { message: 'Invalid token.' } },
                    });
                }
                return Promise.resolve({
                    config,
                    status: 201,
                    data: {
                        success: true,
                        data: { id: 'conn', status: 'ACTIVE', keyLast4: 'lkey', lastError: null },
                    },
                });
            }
            return Promise.resolve({ config, status: 200, data: { success: true, data: null } });
        });
        const { View } = await loadShowpassClient(adapter);
        render(<Harness View={View} />);
        fireEvent.change(await screen.findByLabelText('Showpass API key'), { target: { value: 'sp_demo_revoked_key' } });
        fireEvent.change(screen.getByLabelText('Showpass webhook secret'), { target: { value: 'sp_demo_webhook_secret' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Showpass key' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid token.');
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Send Report' })).not.toBeInTheDocument();
        const rejected = adapter.mock.calls.map(([config]) => config).find((config) => config.method === 'post');
        expect(rejected.suppressGlobalError).toBe(true);

        fireEvent.change(screen.getByLabelText('Showpass API key'), { target: { value: 'sp_demo_valid_key' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Showpass key' }));
        expect(await screen.findByText(/Connected\. Key ending lkey/)).toBeInTheDocument();
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Send Report' })).not.toBeInTheDocument();
        expect(screen.queryByText('Invalid token.')).not.toBeInTheDocument();
    });

    it('still raises the global toast for an unhandled API error', async () => {
        const adapter = vi.fn((config) => Promise.reject({
            config,
            response: { status: 500, data: { message: 'Boom' } },
        }));
        const { View } = await loadShowpassClient(adapter);
        render(<Harness View={View} />);
        expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Send Report' })).toBeInTheDocument();
        expect(screen.getByText('Error Code: 500')).toBeInTheDocument();
    });
});
