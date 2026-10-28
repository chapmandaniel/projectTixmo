import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import VenueWizard from '../features/VenueWizard';

vi.mock('../lib/api', () => ({ default: { post: vi.fn() } }));

describe('venue wizard defaults', () => {
    it('starts in Canada and America/St_Johns with an empty policy URL', () => {
        render(<VenueWizard onClose={vi.fn()} onSuccess={vi.fn()} isDark={false} user={{ organizationId: 'org' }} />);
        fireEvent.change(screen.getByLabelText('Venue Name'), { target: { value: 'Signal Hall' } });
        fireEvent.change(screen.getByLabelText('Capacity'), { target: { value: '400' } });
        fireEvent.click(screen.getByRole('button', { name: /Next Step/ }));
        expect(screen.getByLabelText('Country')).toHaveValue('Canada');
        expect(screen.getByLabelText('Timezone')).toHaveValue('America/St_Johns');
        expect(screen.getByLabelText('Venue policy URL')).toHaveValue('');
    });
});
