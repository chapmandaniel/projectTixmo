import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import OrderDetailModal from './OrderDetailModal';
import { DashboardButton, DashboardSelect, DashboardSurface, DashboardTextInput } from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';
import { ordersToCsv } from '../lib/ordersCsv';
import { formatEventMoney } from '../lib/publicEvent';

const unwrap = (response) => response.data.data || response.data;
const ECC_Orders = ({ event, isDark }) => {
    const theme = getDashboardTheme(isDark);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [exporting, setExporting] = useState(false);
    const [opening, setOpening] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [refresh, setRefresh] = useState(0);
    const limit = 20;
    const filters = { eventId: event.id, ...(search && { search }), ...(status && { status }) };
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        api.get('/orders', { params: { ...filters, page, limit } }).then((response) => {
            if (!active) return;
            const data = unwrap(response);
            setOrders(data.orders || []);
            setTotal(data.pagination?.total || 0);
        }).catch((requestError) => {
            if (active) { setOrders([]); setTotal(0); setError(requestError.response?.data?.message || 'Unable to load event orders.'); }
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [event.id, page, search, status, refresh]);
    const viewOrder = async (id) => {
        setOpening(id);
        setActionError('');
        try { setSelectedOrder(unwrap(await api.get(`/orders/${id}`))); }
        catch (requestError) { setActionError(requestError.response?.data?.message || 'Unable to open this order.'); }
        finally { setOpening(null); }
    };
    const exportOrders = async () => {
        setExporting(true);
        setActionError('');
        try {
            const rows = new Map();
            let exportPage = 1, pages = 1, expectedTotal;
            do {
                const data = unwrap(await api.get('/orders', { params: { ...filters, page: exportPage, limit: 100 } }));
                if (expectedTotal !== undefined && expectedTotal !== data.pagination?.total) throw new Error('Orders changed during export. Please try again.');
                expectedTotal = data.pagination?.total ?? data.orders?.length ?? 0;
                if (expectedTotal > 50000) throw new Error('Narrow the filters to export up to 50,000 orders.');
                for (const order of data.orders || []) rows.set(order.id, order);
                pages = data.pagination?.pages || 1;
                exportPage += 1;
            } while (exportPage <= pages);
            if (rows.size !== expectedTotal) throw new Error('Orders changed during export. Please try again.');
            const url = URL.createObjectURL(new Blob(['\uFEFF', ordersToCsv([...rows.values()])], { type: 'text/csv;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `event-${event.id}-orders.csv`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (requestError) { setActionError(requestError.response?.data?.message || requestError.message || 'Unable to export orders.'); }
        finally { setExporting(false); }
    };
    const money = (order) => formatEventMoney(order.totalAmount, order.currency || 'cad');
    return <div className={`space-y-5 ${theme.textPrimary}`}>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}>
            <label className="block w-full space-y-2 text-sm sm:w-80">Search orders<DashboardTextInput isDark={isDark} aria-label="Search orders" placeholder="Order number, name, email" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={200} /></label>
            <DashboardButton isDark={isDark} type="submit">Search</DashboardButton>
            <label className="block space-y-2 text-sm">Order status<DashboardSelect isDark={isDark} aria-label="Order status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{['PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</DashboardSelect></label>
            <DashboardButton isDark={isDark} variant="secondary" disabled={exporting || loading || Boolean(error)} onClick={exportOrders}>{exporting ? 'Exporting…' : 'Export CSV'}</DashboardButton>
        </form>
        {(error || actionError) && <p role="alert">{actionError || error}</p>}
        <DashboardSurface isDark={isDark}>
            {loading ? <p role="status" className="p-6">Loading orders…</p> : error ? <DashboardButton isDark={isDark} className="m-5" variant="secondary" onClick={() => setRefresh((value) => value + 1)}>Retry orders</DashboardButton> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Order', 'Customer', 'Date', 'Status', 'Total', 'Tickets', 'Action'].map((heading) => <th key={heading} className="p-4">{heading}</th>)}</tr></thead><tbody>
                {!orders.length ? <tr><td colSpan="7" className="p-8 text-center">No orders match this selection.</td></tr> : orders.map((order) => <tr key={order.id} className={`border-t ${theme.divider}`}><td className="p-4">{order.orderNumber}</td><td className="p-4">{[order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') || 'Customer unavailable'}<p className={theme.textSecondary}>{order.user?.email}</p></td><td className="p-4">{new Date(order.createdAt).toLocaleString()}</td><td className="p-4"><StatusBadge status={order.status} isDark={isDark} /></td><td className="whitespace-nowrap p-4">{money(order)}</td><td className="p-4">{order.tickets?.length || 0}</td><td className="p-4"><DashboardButton isDark={isDark} variant="secondary" disabled={Boolean(opening)} onClick={() => viewOrder(order.id)}>{opening === order.id ? 'Opening…' : 'View order'}</DashboardButton></td></tr>)}
            </tbody></table></div>}
        </DashboardSurface>
        {total > limit && <div className="flex flex-wrap items-center gap-3"><DashboardButton isDark={isDark} variant="secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</DashboardButton><span>Page {page} of {Math.ceil(total / limit)} · {total} orders</span><DashboardButton isDark={isDark} variant="secondary" disabled={loading || page * limit >= total} onClick={() => setPage((value) => value + 1)}>Next</DashboardButton></div>}
        {selectedOrder && <OrderDetailModal key={selectedOrder.id} order={selectedOrder} isDark={isDark} onClose={() => setSelectedOrder(null)} onOrderUpdated={() => setRefresh((value) => value + 1)} />}
    </div>;
};
export default ECC_Orders;
