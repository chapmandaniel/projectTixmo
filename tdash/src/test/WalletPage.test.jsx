import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WalletPage from '../pages/WalletPage';
const calls = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../lib/api', () => ({ api: calls }));
vi.mock('../pages/CheckoutPage', () => ({ BuyerAuthPanel: () => <p>Sign in for wallet</p> }));
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
});
