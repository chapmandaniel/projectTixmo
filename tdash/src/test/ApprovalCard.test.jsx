import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ApprovalCard from '../components/ApprovalCard';

describe('ApprovalCard', () => {
    const mockApproval = {
        title: 'Test Approval',
        status: 'PENDING',
        priority: 'URGENT',
        event: { name: 'Test Event' },
        dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        reviewers: [],
        comments: [],
        assets: []
    };

    it('renders title and event name', () => {
        render(<ApprovalCard approval={mockApproval} />);
        expect(screen.getByText('Test Approval')).toBeInTheDocument();
        expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

    it('renders status correctly', () => {
        render(<ApprovalCard approval={mockApproval} />);
        expect(screen.getByText('Pending Review')).toBeInTheDocument();
    });

    it('renders priority correctly', () => {
        render(<ApprovalCard approval={mockApproval} />);
        expect(screen.getByText('Urgent')).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const handleClick = vi.fn();
        const { container } = render(<ApprovalCard approval={mockApproval} onClick={handleClick} />);
        fireEvent.click(container.firstChild);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders in compact mode', () => {
        const { container } = render(<ApprovalCard approval={mockApproval} compact={true} />);
        expect(screen.getByText('Test Approval')).toBeInTheDocument();
        expect(container.firstChild).toHaveClass('flex', 'items-center', 'gap-4');
    });

    it('renders in dark mode', () => {
        const { container } = render(<ApprovalCard approval={mockApproval} isDark={true} />);
        expect(container.firstChild).toHaveClass('bg-[#1A1A1A]');
    });
});
