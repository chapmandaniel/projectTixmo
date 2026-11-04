import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { DashboardButton, DashboardEmptyState, DashboardSelect, DashboardStat, DashboardSurface } from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';
import { orderDisplayCurrency } from '../lib/runtimeConfig';
import { formatEventMoney } from '../lib/publicEvent';
import { externalPurchaseUrl, vendorEventAllows } from '../lib/ticketingMode';

const payload = (response) => response.data.data || response.data;

const showpassSoldTotal = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length || list.some((row) => row?.soldCount === null || row?.soldCount === undefined)) return null;
    return list.reduce((sum, row) => sum + Number(row.soldCount), 0);
};
const ECC_Overview = ({ event, isDark, onViewOrders }) => {
    const theme = getDashboardTheme(isDark);
    const [days, setDays] = useState('7');
    const eventCurrency = String(event.currency || 'cad').toLowerCase();
    const [currency, setCurrency] = useState(eventCurrency);
    const [refresh, setRefresh] = useState(0);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        setData(null);
        const ordersAllowed = vendorEventAllows(event, 'orders');
        if (!ordersAllowed) {
            const organizationId = event.organizationId;
            if (!organizationId) {
                setData({ externalOrders: true, showpassSold: null });
                setLoading(false);
                return undefined;
            }
            api.get(`/organizations/${organizationId}/showpass/sold-counts`, { params: { eventId: event.id } })
                .then((response) => {
                    if (active) setData({ externalOrders: true, showpassSold: showpassSoldTotal(payload(response)) });
                })
                .catch((requestError) => {
                    if (active) setError(requestError.response?.data?.message || 'Unable to load Showpass sold counts.');
                })
                .finally(() => { if (active) setLoading(false); });
            return () => { active = false; };
        }
        const end = new Date(), start = new Date(end.getTime() - Number(days) * 86400000);
        Promise.all([
            api.get('/analytics/sales', { params: { eventId: event.id, currency, startDate: start.toISOString(), endDate: end.toISOString() } }),
            api.get(`/events/${event.id}/stats`),
            api.get('/orders', { params: { eventId: event.id, status: 'PAID', limit: 10, page: 1 } }),
        ]).then(([sales, stats, orders]) => {
            if (active) setData({
                sales: payload(sales),
                stats: payload(stats),
                orders: payload(orders).orders || [],
                externalOrders: false,
            });
        }).catch((requestError) => {
            if (active) setError(requestError.response?.data?.message || 'Unable to load event overview.');
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [event.id, event.organizationId, event.ticketingMode, days, currency, refresh]);
    const money = (amount, code = currency) => formatEventMoney(amount, code);
    const salesTimezone = data?.sales?.aggregationTimezone || 'UTC';
    return <div className={`space-y-6 ${theme.textPrimary}`}>
        {!data?.externalOrders && <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-2 text-sm">Sales period<DashboardSelect isDark={isDark} aria-label="Sales period" value={days} onChange={(e) => setDays(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></DashboardSelect></label>
            <label className="space-y-2 text-sm">Revenue currency<DashboardSelect isDark={isDark} aria-label="Revenue currency" value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="cad">CAD</option><option value="usd">USD (historical orders)</option>{eventCurrency !== 'cad' && eventCurrency !== 'usd' ? <option value={eventCurrency}>{eventCurrency.toUpperCase()}</option> : null}</DashboardSelect></label>
            <DashboardButton isDark={isDark} variant="secondary" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Refresh</DashboardButton>
        </div>}
        {loading ? <p role="status">Loading event overview…</p> : error ? <p role="alert">{error}</p> : data?.externalOrders ? (
            <DashboardSurface isDark={isDark} className="space-y-3 p-5">
                <h3 className="text-xl font-light">Showpass</h3>
                <p>{data.showpassSold === null ? 'No count from Showpass' : `Sold on Showpass: ${data.showpassSold}`}</p>
                <p>Tickets sold on Showpass</p>
                {externalPurchaseUrl(event) ? <a href={externalPurchaseUrl(event)} target="_blank" rel="noopener noreferrer">Buy tickets on Showpass</a> : null}
            </DashboardSurface>
        ) : data && <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DashboardStat isDark={isDark} label="Paid revenue" value={money(data.sales.totalRevenue)} detail={`Last ${days} days · ${currency.toUpperCase()} only`} />
                <DashboardStat isDark={isDark} label="Paid orders" value={data.sales.totalOrders} detail={`Last ${days} days · ${currency.toUpperCase()} only`} />
                <DashboardStat isDark={isDark} label="Tickets sold" value={data.stats.ticketsSold} detail={event.capacity > 0 ? `Event total · capacity ${event.capacity}` : 'Event total · capacity not configured'} />
                <DashboardStat isDark={isDark} label="Admitted tickets" value={data.stats.ticketsUsed} detail="Event total · recorded admissions" />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
                <DashboardSurface isDark={isDark} className="p-5 lg:col-span-2">
                    <h3 className="text-xl font-light">Daily paid sales</h3>
                    <p className={`mt-2 text-sm ${theme.textSecondary}`}>Recorded order dates in {salesTimezone}. Refunds are excluded from paid revenue.</p>
                    {!data.sales.salesByDay?.length ? <DashboardEmptyState isDark={isDark} title="No paid sales in this period" description="Change the period or currency to inspect other orders." className="mt-5" /> : <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Date ({salesTimezone})</th><th className="p-3">Orders</th><th className="p-3">Tickets</th><th className="p-3">Revenue</th></tr></thead><tbody>{data.sales.salesByDay.map((day) => <tr key={day.date} className={`border-t ${theme.divider}`}><td className="p-3">{day.date}</td><td className="p-3">{day.orders}</td><td className="p-3">{day.tickets}</td><td className="p-3">{money(day.revenue)}</td></tr>)}</tbody></table></div>}
                </DashboardSurface>
                <DashboardSurface isDark={isDark} className="space-y-4 p-5">
                    <h3 className="text-xl font-light">Recent paid orders</h3>
                    {data.externalOrders ? <div className="space-y-3"><p>Tickets sold on Showpass</p>{externalPurchaseUrl(event) ? <a href={externalPurchaseUrl(event)} target="_blank" rel="noopener noreferrer">Buy tickets on Showpass</a> : null}</div> : !data.orders.length ? <p className={`text-sm ${theme.textSecondary}`}>No paid orders recorded.</p> : <ul className="space-y-4">{data.orders.map((order) => <li key={order.id} className="text-sm"><p>{order.orderNumber} · {money(order.totalAmount, orderDisplayCurrency(order.currency))}</p><p className={theme.textSecondary}>{new Date(order.createdAt).toLocaleString()}</p></li>)}</ul>}
                    {onViewOrders && !data.externalOrders && <DashboardButton isDark={isDark} variant="secondary" onClick={onViewOrders}>View orders</DashboardButton>}
                </DashboardSurface>
            </div>
            <p className={`text-sm ${theme.textSecondary}`}>Page views and conversion rate are unavailable until traffic reporting is connected.</p>
        </>}
    </div>;
};
export default ECC_Overview;
