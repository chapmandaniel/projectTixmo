import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LabsBanner from '../components/LabsBanner';
import App from '../App';

vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { notifications: [], approvals: [], data: { notifications: [], approvals: [] } } }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
}));

vi.mock('../lib/auth', () => ({
    auth: {
        getCurrentUser: () => null,
        logout: vi.fn(),
        login: vi.fn(),
        isAuthenticated: () => false,
    },
}));

describe('Labs banner', () => {
    afterEach(() => {
        delete window.__TIXMO_CONFIG__;
    });

    it('stays hidden when no branch is configured', () => {
        const { container } = render(<LabsBanner />);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the branch as text and has no dismiss control', () => {
        window.__TIXMO_CONFIG__ = {
            labsBranch: 'cursor/vendor-import-showpass-5658 <img src=x onerror=alert(1)>',
        };
        const { container } = render(<LabsBanner />);
        const banner = screen.getByRole('status');
        expect(banner).toHaveTextContent('Labs · cursor/vendor-import-showpass-5658 <img src=x onerror=alert(1)>');
        expect(container.querySelector('img')).toBeNull();
        expect(screen.queryByRole('button', { name: /dismiss|close/i })).not.toBeInTheDocument();
    });

    it('shows the banner on the login page', async () => {
        window.__TIXMO_CONFIG__ = { labsBranch: 'cursor/vendor-import-showpass-5658' };
        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );
        expect(await screen.findByRole('status')).toHaveTextContent('Labs · cursor/vendor-import-showpass-5658');
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });
});
