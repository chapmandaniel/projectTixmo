import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getPolicyLinks, orderDisplayCurrency } from '../lib/runtimeConfig';
import { BuyerAuthPanel } from './CheckoutPage';
import { DashboardButton, DashboardChip, DashboardPage, DashboardPageHeader, DashboardSurface, DashboardTextInput } from '../components/dashboard/DashboardPrimitives';
import { eventAddress, formatEventMoney, hstAmountLine, hstRegistrationLine } from '../lib/publicEvent';

const payload = (response) => response?.data?.data || response?.data || response;
const money = (order) => formatEventMoney(order.totalAmount, orderDisplayCurrency(order.currency));
const venueLine = (order) => [order.event?.venue?.name, eventAddress(order.event?.venue)].filter(Boolean).join(', ') || 'Venue to be announced';
const WalletPage = ({ user, onAuthenticated }) => {
    const [sessionExpired, setSessionExpired] = useState(false);
    const [orders, setOrders] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [refresh, setRefresh] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [qr, setQr] = useState(null);
    const [transfer, setTransfer] = useState(null);
    const [recipient, setRecipient] = useState('');
    const handleError = (e) => {
        if (e.response?.status === 401) {
            setSessionExpired(true);
            setOrders([]); setTickets([]); setQr(null); setTransfer(null); setNotice('');
            setError('');
        } else setError(e.response?.data?.message || e.message);
    };
    const handleAuthenticated = (buyer) => {
        setSessionExpired(false);
        setRefresh(n => n + 1);
        onAuthenticated(buyer);
    };
    useEffect(() => {
        if (!user || sessionExpired) return undefined;
        let cancelled = false;
        setLoading(true); setError(''); setQr(null);
        Promise.all([api.get(`/orders/mine?page=${page}&limit=20`), api.get(`/tickets/mine?page=${page}&limit=20`)])
            .then(([orderResponse, ticketResponse]) => {
                if (cancelled) return;
                const o = payload(orderResponse), t = payload(ticketResponse);
                setOrders(o.orders || []); setTickets(t.tickets || []);
                setPages(Math.max(o.pagination?.pages || 1, t.pagination?.pages || 1));
            }).catch(e => { if (!cancelled) handleError(e); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [user?.id, page, refresh, sessionExpired]);
    const action = async (fn, refreshAfter = true) => {
        setBusy(true); setError(''); setNotice('');
        try { await fn(); if (refreshAfter) setRefresh(n => n + 1); }
        catch (e) { handleError(e); }
        finally { setBusy(false); }
    };
    return <main className="min-h-screen bg-dashboard-shell px-4 py-8 text-zinc-100 sm:px-8">
        <DashboardPage className="mx-auto max-w-5xl">
            <DashboardPageHeader isDark title="My tickets" description={user && !sessionExpired ? user.email : 'Sign in to see your tickets and order status.'}
                actions={user && !sessionExpired ? <DashboardButton isDark variant="secondary" disabled={loading || busy} onClick={() => setRefresh(n => n + 1)}>Refresh</DashboardButton> : null} />
            {!user || sessionExpired ? <>
                {sessionExpired ? <p role="status">Your session expired. Sign in again to retrieve your tickets. Do not purchase again.</p> : null}
                <BuyerAuthPanel currentUser={null} onAuthenticated={handleAuthenticated} />
            </> : <>
                {error ? <p role="alert">{error}</p> : null}
                {notice ? <p role="status">{notice}</p> : null}
                <p className="text-sm text-dashboard-muted">Need a refund because an event was cancelled or rescheduled? We'll handle it. {getPolicyLinks().refundPolicyUrl ? <a className="underline" href={getPolicyLinks().refundPolicyUrl} target="_blank" rel="noreferrer">See the refund policy</a> : 'See the refund policy.'}</p>
                {loading ? <p role="status">Loading wallet…</p> : <>
                    <DashboardSurface isDark className="p-5">
                        <h2 className="mb-4 text-xl">Tickets</h2>
                        {!tickets.length ? <p className="text-dashboard-muted">No tickets yet.</p> : tickets.map(ticket => {
                            const usable = ticket.status === 'VALID' && ticket.order?.status === 'PAID' && ticket.order?.refundStatus !== 'PROCESSING';
                            return <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-dashboard-border py-4">
                                <div><p>{ticket.event?.name}</p><p className="text-sm text-dashboard-muted">{ticket.ticketType?.name}</p></div>
                                <DashboardChip isDark>{ticket.order?.refundStatus === 'PROCESSING' ? 'Refund processing' : ticket.order?.status === 'PENDING' ? 'Awaiting payment' : ticket.status}</DashboardChip>
                                {usable ? <div className="flex flex-wrap gap-2">
                                    <DashboardButton isDark disabled={busy} onClick={() => action(async () => {
                                        const result = payload(await api.get(`/tickets/${ticket.id}/qr`));
                                        setQr({ id: ticket.id, image: result.qrCode, name: ticket.event?.name });
                                    }, false)}>Show ticket</DashboardButton>
                                    <DashboardButton isDark variant="secondary" disabled={busy} onClick={() => { setTransfer(ticket); setRecipient(''); }}>Transfer</DashboardButton>
                                </div> : null}
                            </div>;
                        })}
                    </DashboardSurface>
                    {qr ? <DashboardSurface isDark className="p-5">
                        <h2 className="text-xl">{qr.name}</h2>
                        <img className="mx-auto my-4 w-64 max-w-full" src={qr.image} alt="Ticket admission QR code" />
                        <DashboardButton isDark variant="secondary" onClick={() => setQr(null)}>Hide ticket</DashboardButton>
                    </DashboardSurface> : null}
                    <DashboardSurface isDark className="p-5">
                        <h2 className="mb-1 text-xl">Orders</h2>
                        <p className="mb-4 text-sm text-dashboard-muted">All sales are final.</p>
                        {!orders.length ? <p className="text-dashboard-muted">No orders yet.</p> : orders.map(order => <div key={order.id} className="space-y-3 border-b border-dashboard-border py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3"><p>{order.event?.name} · {order.orderNumber}</p><p>{money(order)}</p></div>
                            <p className="text-sm text-dashboard-muted">{venueLine(order)}</p>
                            <p className="text-sm text-dashboard-muted">{hstAmountLine(order.totalAmount, order.receiptDisclosure?.hstRate, order.receiptDisclosure?.hstAmount)}</p>
                            {hstRegistrationLine(order.receiptDisclosure?.hstNumber) ? <p className="text-sm text-dashboard-muted">{hstRegistrationLine(order.receiptDisclosure?.hstNumber)}</p> : null}
                            <p className="text-sm text-dashboard-muted">{order.status}{order.refundStatus && order.refundStatus !== 'NONE' ? ` · Refund ${order.refundStatus.toLowerCase()}` : ''}</p>
                            {order.status === 'PAID' ? <DashboardButton isDark variant="secondary" disabled={busy} onClick={() => action(async () => { await api.post(`/orders/${order.id}/receipt`); setNotice('Receipt sent to your email.'); })}>Resend receipt</DashboardButton> : order.status === 'PENDING' ? <DashboardButton isDark variant="secondary" disabled={busy} onClick={() => action(async () => { await api.post(`/orders/${order.id}/cancel`); setNotice('Reservation cancelled.'); })}>Cancel reservation</DashboardButton> : null}
                        </div>)}
                    </DashboardSurface>
                    <div className="flex items-center justify-between gap-3">
                        <DashboardButton isDark variant="secondary" disabled={page <= 1 || busy} onClick={() => setPage(p => p - 1)}>Previous</DashboardButton>
                        <span className="text-sm text-dashboard-muted">Page {page} of {pages}</span>
                        <DashboardButton isDark variant="secondary" disabled={page >= pages || busy} onClick={() => setPage(p => p + 1)}>Next</DashboardButton>
                    </div>
                </>}
                {transfer ? <DashboardSurface isDark role="dialog" aria-label="Transfer ticket" className="p-5 space-y-4">
                    <h2 className="text-xl">Transfer ticket</h2><p className="text-sm text-dashboard-muted">The recipient needs a Tixmo account. Your current QR code will stop working.</p>
                    <form onSubmit={e => { e.preventDefault(); void action(async () => { await api.post(`/tickets/${transfer.id}/transfer`, { recipientEmail: recipient }); setTransfer(null); setQr(null); setNotice('Ticket transferred.'); }); }} className="space-y-3">
                        <DashboardTextInput isDark type="email" aria-label="Recipient email" value={recipient} onChange={e => setRecipient(e.target.value)} required />
                        <DashboardButton isDark type="submit" disabled={busy}>Confirm transfer</DashboardButton>
                        <DashboardButton isDark variant="secondary" disabled={busy} onClick={() => setTransfer(null)}>Cancel</DashboardButton>
                    </form>
                </DashboardSurface> : null}
            </>}
            <Link to="/" className="text-sm text-dashboard-muted underline">Tixmo</Link>
        </DashboardPage>
    </main>;
};
export default WalletPage;
