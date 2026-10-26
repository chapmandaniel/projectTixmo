import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WalletPage from '../pages/WalletPage';
const calls = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../lib/api', () => ({ api: calls }));
vi.mock('../pages/CheckoutPage', () => ({ BuyerAuthPanel: ({ onAuthenticated }) => <><p>Sign in for wallet</p><button onClick={() => onAuthenticated({ id: 'buyer', email: 'buyer@example.com' })}>Restore wallet session</button></> }));
const order = { id: 'order-owned', orderNumber: 'ORD-OWNED', status: 'PAID', totalAmount: 25, currency: 'cad', event: { name: 'Night show' } };
const ticket = { id: 'ticket-owned', status: 'VALID', ticketType: { name: 'Admission' }, event: { name: 'Night show' }, order: { status: 'PAID', refundStatus: 'NONE' } };
const mount = (user = { id: 'buyer', email: 'buyer@example.com' }) => render(<MemoryRouter><WalletPage user={user} onAuthenticated={vi.fn()} /></MemoryRouter>);
describe('Buyer wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.get.mockImplementation(async path => path.startsWith('/orders/mine')
      ? { data: { orders: [order], pagination: { pages: 1 } } }
      : path.startsWith('/tickets/mine') ? { data: { tickets: [ticket], pagination: { pages: 1 } } }
      : path === '/tickets/ticket-owned/qr' ? { data: { qrCode: 'data:image/png;base64,synthetic' } }
      : Promise.reject(new Error(`Unexpected API route: ${path}`)));
    calls.post.mockResolvedValue({ data: { ...order, refundStatus: 'PROCESSING' } });
  });
  it('loads owned records and keeps a requested ticket QR visible', async () => {
    mount();
    await screen.findByText('ORD-OWNED', { exact: false });
    expect(calls.get).toHaveBeenCalledWith('/orders/mine?page=1&limit=20');
    expect(calls.get).toHaveBeenCalledWith('/tickets/mine?page=1&limit=20');
    fireEvent.click(screen.getByRole('button', { name: 'Show ticket' }));
    await waitFor(() => expect(calls.get).toHaveBeenCalledWith('/tickets/ticket-owned/qr'));
    expect(await screen.findByAltText('Ticket admission QR code')).toHaveAttribute('src', 'data:image/png;base64,synthetic');
  });
  it('requires explicit full-order confirmation and reports a pending refund truthfully', async () => {
    mount();
    await screen.findByText('ORD-OWNED', { exact: false });
    fireEvent.click(screen.getByRole('button', { name: 'Refund full order' }));
    expect(calls.post).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Confirm full refund' })).getByRole('button', { name: 'Confirm full refund' }));
    await waitFor(() => expect(calls.post).toHaveBeenCalledWith('/orders/order-owned/request-refund'));
    expect(await screen.findByText(/Refund processing. Refresh/)).toBeInTheDocument();
  });
  it('does not load private records before sign in', () => {
    mount(null);
    expect(screen.getByText('Sign in for wallet')).toBeInTheDocument();
    expect(calls.get).not.toHaveBeenCalled();
  });
  it('resends a paid receipt through the authenticated existing endpoint without creating payment', async () => {
    mount();
    await screen.findByText('ORD-OWNED', { exact: false });
    fireEvent.click(screen.getByRole('button', { name: 'Resend receipt' }));
    expect(await screen.findByText('Receipt sent to your email.')).toBeInTheDocument();
    expect(calls.post.mock.calls).toEqual([['/orders/order-owned/receipt']]);
  });
  it('clears the displayed QR and private records on session expiry and offers reauthentication', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Show ticket' }));
    await screen.findByAltText('Ticket admission QR code');
    calls.post.mockRejectedValueOnce({ response: { status: 401 } });
    fireEvent.click(screen.getByRole('button', { name: 'Resend receipt' }));
    await screen.findByText(/Your session expired/);
    expect(screen.getByText('Sign in for wallet')).toBeInTheDocument();
    expect(screen.queryByAltText('Ticket admission QR code')).not.toBeInTheDocument();
    expect(screen.queryByText('ORD-OWNED', { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText('Receipt sent to your email.')).not.toBeInTheDocument();
    expect(calls.post.mock.calls).toEqual([['/orders/order-owned/receipt']]);
    fireEvent.click(screen.getByRole('button', { name: 'Restore wallet session' }));
    await screen.findByText('ORD-OWNED', { exact: false });
    expect(screen.queryByText(/Your session expired/)).not.toBeInTheDocument();
    expect(screen.queryByAltText('Ticket admission QR code')).not.toBeInTheDocument();
  });
  it('does not show a QR or retry payment when ownership lookup is denied', async () => {
    mount();
    await screen.findByRole('button', { name: 'Show ticket' });
    calls.get.mockRejectedValueOnce({ response: { status: 403, data: { message: 'Ticket unavailable' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Show ticket' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ticket unavailable');
    expect(screen.queryByAltText('Ticket admission QR code')).not.toBeInTheDocument();
    expect(calls.post).not.toHaveBeenCalled();
  });
  it('refetches owned records after reopening rather than retaining a prior QR', async () => {
    const view = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Show ticket' }));
    await screen.findByAltText('Ticket admission QR code');
    view.unmount();
    calls.get.mockClear();
    mount();
    await screen.findByText('ORD-OWNED', { exact: false });
    expect(calls.get).toHaveBeenCalledWith('/orders/mine?page=1&limit=20');
    expect(calls.get).toHaveBeenCalledWith('/tickets/mine?page=1&limit=20');
    expect(screen.queryByAltText('Ticket admission QR code')).not.toBeInTheDocument();
    expect(calls.post).not.toHaveBeenCalled();
  });

  it('shows the venue and HST registration number on the on-screen receipt', async () => {
    const disclosed = {
      ...order,
      event: {
        name: 'Night show',
        venue: { name: 'Signal Hall', address: { street: '1 Harbour Dr', city: "St. John's", state: 'NL' } },
      },
      receiptDisclosure: { hstNumber: '123456789RT0001', hstRate: 0.13, hstAmount: 1.15 },
    };
    calls.get.mockImplementation(async path => path.startsWith('/orders/mine')
      ? { data: { orders: [disclosed], pagination: { pages: 1 } } }
      : path.startsWith('/tickets/mine') ? { data: { tickets: [ticket], pagination: { pages: 1 } } }
      : Promise.reject(new Error(`Unexpected API route: ${path}`)));
    mount();
    expect(await screen.findByText(/Signal Hall, 1 Harbour Dr, St\. John's, NL/)).toBeInTheDocument();
    expect(screen.getByText('HST no. 123456789RT0001')).toBeInTheDocument();
    expect(screen.getByText('Includes HST (13%): CA$1.15')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
  });

  it('hides the HST registration line when the number is unset', async () => {
    mount();
    await screen.findByText('ORD-OWNED', { exact: false });
    expect(screen.getByText('Includes HST (15%): CA$3.26')).toBeInTheDocument();
    expect(screen.getByText('Venue to be announced')).toBeInTheDocument();
    expect(screen.queryByText(/HST no\./)).not.toBeInTheDocument();
  });

  it('fails closed when the initial owned-record lookup has an expired session', async () => {
    calls.get.mockRejectedValue({ response: { status: 401 } });
    mount();
    await screen.findByText(/Your session expired/);
    expect(screen.getByText('Sign in for wallet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show ticket' })).not.toBeInTheDocument();
    expect(calls.post).not.toHaveBeenCalled();
  });

});
