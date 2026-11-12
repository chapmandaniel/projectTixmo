import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';

vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { notifications: [] }, approvals: [] }),
        put: vi.fn().mockResolvedValue({}),
        post: vi.fn().mockResolvedValue({}),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}));

const owner = { firstName: 'Avery', lastName: 'Stone', role: 'OWNER', email: 'demo.admin@tixmo.test' };
const member = { firstName: 'Parker', lastName: 'Reed', role: 'TEAM_MEMBER', email: 'demo.ops@tixmo.test' };

const destinations = ['Home', 'Events', 'Tasks', 'Team', 'Assets', 'Review Portal', 'Analytics', 'Social', 'Settings', 'Audit'];

const renderLayout = (user = owner) => render(
    <MemoryRouter>
        <DashboardLayout activeView="dashboard" isDark user={user} onLogout={vi.fn()}>
            <div>Dashboard Content</div>
        </DashboardLayout>
    </MemoryRouter>
);

describe('Dashboard mobile navigation', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 480 });
        document.body.style.overflow = '';
    });

    it('opens, closes, and reaches every destination at 375px', () => {
        renderLayout();

        const openButton = screen.getByRole('button', { name: 'Open navigation' });
        expect(openButton).toHaveAttribute('aria-expanded', 'false');
        expect(openButton.parentElement).toHaveClass('md:hidden');
        expect(screen.queryByRole('navigation', { name: 'Dashboard' })).not.toBeInTheDocument();

        fireEvent.click(openButton);

        const menu = screen.getByRole('navigation', { name: 'Dashboard' });
        expect(menu).toHaveClass('overflow-y-auto');
        expect(menu).toHaveStyle({ maxHeight: '480px' });
        expect(document.body.style.overflow).toBe('hidden');

        const links = within(menu).getAllByRole('link');
        expect(links.map((link) => link.textContent)).toEqual(destinations);
        links.forEach((link) => {
            expect(link).toHaveAttribute('href');
            expect(menu.scrollHeight).toBeGreaterThanOrEqual(link.offsetTop);
        });

        fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
        expect(screen.queryByRole('navigation', { name: 'Dashboard' })).not.toBeInTheDocument();
        expect(document.body.style.overflow).toBe('');

        fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
        fireEvent.click(within(screen.getByRole('navigation', { name: 'Dashboard' })).getByRole('link', { name: 'Events' }));
        expect(screen.queryByRole('navigation', { name: 'Dashboard' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('navigation', { name: 'Dashboard' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss navigation' }));
        expect(screen.queryByRole('navigation', { name: 'Dashboard' })).not.toBeInTheDocument();
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });

    it('hides owner-only destinations from members', () => {
        renderLayout(member);
        fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
        const menu = screen.getByRole('navigation', { name: 'Dashboard' });
        expect(within(menu).queryByRole('link', { name: 'Audit' })).not.toBeInTheDocument();
        expect(within(menu).getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    });
});
