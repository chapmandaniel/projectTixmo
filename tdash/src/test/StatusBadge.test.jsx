import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge from '../components/StatusBadge';
import { API_ENUMS } from '../data/mockData';

describe('StatusBadge', () => {
    const testCases = [
        // EventStatus
        { status: API_ENUMS.EventStatus.ON_SALE, expectedText: 'on sale', lightClass: 'bg-emerald-50 text-emerald-700', darkClass: 'bg-emerald-900/10 text-emerald-400/80' },
        { status: API_ENUMS.EventStatus.PUBLISHED, expectedText: 'published', lightClass: 'bg-blue-50 text-blue-700', darkClass: 'bg-blue-900/10 text-blue-400/80' },
        { status: API_ENUMS.EventStatus.DRAFT, expectedText: 'draft', lightClass: 'bg-gray-100 text-gray-600', darkClass: 'bg-[#2a2a2a] text-gray-400' },
        { status: API_ENUMS.EventStatus.SOLD_OUT, expectedText: 'sold out', lightClass: 'bg-rose-50 text-rose-700', darkClass: 'bg-rose-900/10 text-rose-400/80' },

        // OrderStatus
        { status: API_ENUMS.OrderStatus.PAID, expectedText: 'paid', lightClass: 'bg-emerald-50 text-emerald-700', darkClass: 'bg-emerald-900/10 text-emerald-400/80' },
        { status: API_ENUMS.OrderStatus.PENDING, expectedText: 'pending', lightClass: 'bg-amber-50 text-amber-700', darkClass: 'bg-amber-900/10 text-amber-400/80' },
        { status: API_ENUMS.OrderStatus.CANCELLED, expectedText: 'cancelled', lightClass: 'bg-gray-50 text-gray-500', darkClass: 'bg-[#2a2a2a] text-gray-500' },

        // Literals
        { status: 'ACTIVE', expectedText: 'active', lightClass: 'bg-emerald-50 text-emerald-700', darkClass: 'bg-emerald-900/10 text-emerald-400/80' },
        { status: 'SUSPENDED', expectedText: 'suspended', lightClass: 'bg-rose-50 text-rose-700', darkClass: 'bg-rose-900/10 text-rose-400/80' },
        // 'PENDING' is already covered by OrderStatus.PENDING which has same value 'PENDING', but let's be explicit if needed.
        // OrderStatus.PENDING is 'PENDING'.
    ];

    describe('Light Mode', () => {
        testCases.forEach(({ status, expectedText, lightClass }) => {
            it(`renders correctly for status: ${status}`, () => {
                const { container } = render(<StatusBadge status={status} isDark={false} />);

                const badge = screen.getByText(expectedText);
                expect(badge).toBeInTheDocument();

                // Check for classes
                const classes = lightClass.split(' ');
                classes.forEach(c => {
                    expect(badge).toHaveClass(c);
                });

                expect(badge).toHaveClass('px-2.5 py-1 rounded-full text-xs font-normal capitalize');

                // Snapshot
                expect(container).toMatchSnapshot();
            });
        });

        it('renders default styles for unknown status', () => {
            const { container } = render(<StatusBadge status="UNKNOWN_STATUS" isDark={false} />);
            const badge = screen.getByText('unknown status');
            expect(badge).toHaveClass('bg-gray-50');
            expect(container).toMatchSnapshot();
        });
    });

    describe('Dark Mode', () => {
        testCases.forEach(({ status, expectedText, darkClass }) => {
            it(`renders correctly for status: ${status}`, () => {
                const { container } = render(<StatusBadge status={status} isDark={true} />);

                const badge = screen.getByText(expectedText);
                expect(badge).toBeInTheDocument();

                // Check for classes
                const classes = darkClass.split(' ');
                classes.forEach(c => {
                    expect(badge).toHaveClass(c);
                });

                expect(badge).toHaveClass('px-2.5 py-1 rounded-full text-xs font-normal capitalize');

                 // Snapshot
                 expect(container).toMatchSnapshot();
            });
        });

        it('renders default styles for unknown status', () => {
            const { container } = render(<StatusBadge status="UNKNOWN_STATUS" isDark={true} />);
            const badge = screen.getByText('unknown status');
            expect(badge).toHaveClass('bg-[#2a2a2a]');
            expect(container).toMatchSnapshot();
        });
    });

    it('renders empty when status is null/undefined', () => {
         const { container } = render(<StatusBadge status={null} />);
         const span = container.querySelector('span');
         expect(span).toBeInTheDocument();
         expect(span).toHaveTextContent('');
         expect(container).toMatchSnapshot();
    });
});
