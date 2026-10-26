import React from 'react';
import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ScannerPage from '../pages/ScannerPage';

it('clears a prior admission when the operator enters a different ticket', async () => {
  const reply = data => ({ ok: true, json: async () => ({ success: true, data }) });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ name: 'QA gate', status: 'ACTIVE' })).mockResolvedValueOnce(reply({ success: true })));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  const { unmount } = render(<ScannerPage />);
  try {
    fireEvent.change(screen.getByLabelText('Scanner API key'), { target: { value: 'sk_scanner_synthetic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect scanner' }));
    await screen.findByText('QA gate');
    fireEvent.change(screen.getByLabelText('Ticket QR or barcode'), { target: { value: 'TICKET:11111111-1111-4111-8111-111111111111:TIX-FIRST:22222222-2222-4222-8222-222222222222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check ticket for entry' }));
    await screen.findByText('Admitted');
    fireEvent.change(screen.getByLabelText('Ticket QR or barcode'), { target: { value: 'TICKET:33333333-3333-4333-8333-333333333333:TIX-NEXT:22222222-2222-4222-8222-222222222222' } });
    expect(screen.queryByText('Admitted')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally { unmount(); vi.unstubAllGlobals(); }
});
