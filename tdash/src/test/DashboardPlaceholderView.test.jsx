import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageCircle } from 'lucide-react';
import DashboardPlaceholderView from '../features/DashboardPlaceholderView';

describe('DashboardPlaceholderView', () => {
    it('renders a future-module placeholder without workflow controls', () => {
        render(<DashboardPlaceholderView isDark title="Social" icon={MessageCircle} />);

        expect(screen.getByRole('heading', { name: 'Social' })).toBeInTheDocument();
        expect(screen.getByText('Future module')).toBeInTheDocument();
        expect(screen.getByText('No active workflows, API calls, generated content, or monitoring jobs are attached to this space.')).toBeInTheDocument();
        expect(screen.getByText('Ready for a future build')).toBeInTheDocument();
        expect(screen.queryByText('Monitoring rules')).not.toBeInTheDocument();
        expect(screen.queryByText('Generate')).not.toBeInTheDocument();
    });
});
