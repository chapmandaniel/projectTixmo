import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatCard from '../components/StatCard';

describe('StatCard', () => {
    it('renders title and value correctly', () => {
        render(<StatCard title="Total Sales" value="$1,234" trend="12%" trendUp={true} />);
        expect(screen.getByText('Total Sales')).toBeInTheDocument();
        expect(screen.getByText('$1,234')).toBeInTheDocument();
    });

    it('renders trend up correctly', () => {
        render(<StatCard title="Test" value="100" trend="10%" trendUp={true} />);
        const trendElement = screen.getByText('10%');
        expect(trendElement).toBeInTheDocument();
        expect(trendElement.parentElement).toHaveClass('text-emerald-600');
    });

    it('renders trend down correctly', () => {
        render(<StatCard title="Test" value="100" trend="5%" trendUp={false} />);
        const trendElement = screen.getByText('5%');
        expect(trendElement).toBeInTheDocument();
        expect(trendElement.parentElement).toHaveClass('text-rose-600');
    });

    it('renders correctly in dark mode', () => {
        const { container } = render(<StatCard title="Dark Mode" value="100" trend="5%" trendUp={true} isDark={true} />);
        expect(container.firstChild).toHaveClass('bg-[#1e1e1e]');
    });

    it('renders correctly in light mode', () => {
        const { container } = render(<StatCard title="Light Mode" value="100" trend="5%" trendUp={true} isDark={false} />);
        expect(container.firstChild).toHaveClass('bg-white');
    });
});
