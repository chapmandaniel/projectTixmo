import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, ArrowUpDown, RefreshCw, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import OrderDetailModal from './OrderDetailModal';

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'event-asc', label: 'Event A-Z' },
    { value: 'event-desc', label: 'Event Z-A' },
    { value: 'amount-desc', label: 'Amount high-low' },
    { value: 'amount-asc', label: 'Amount low-high' },
];

const normalizeEventName = (order) => order.event?.title || order.event?.name || 'Deleted Event';

const sortOrders = (orders, sortBy) => {
    const sorted = [...orders];

    sorted.sort((left, right) => {
        if (sortBy === 'oldest') {
            return new Date(left.createdAt) - new Date(right.createdAt);
        }

        if (sortBy === 'event-asc') {
            return normalizeEventName(left).localeCompare(normalizeEventName(right));
        }

        if (sortBy === 'event-desc') {
            return normalizeEventName(right).localeCompare(normalizeEventName(left));
        }

        if (sortBy === 'amount-desc') {
            return (Number(right.totalAmount) || 0) - (Number(left.totalAmount) || 0);
        }

        if (sortBy === 'amount-asc') {
            return (Number(left.totalAmount) || 0) - (Number(right.totalAmount) || 0);
        }

        return new Date(right.createdAt) - new Date(left.createdAt);
    });

    return sorted;
};

const OrdersView = ({
    isDark,
    title = 'Orders',
    description = 'View and manage ticket sales and transactions.',
    embedded = false,
    eventOptions = [],
}) => {
    const [orders, setOrders] = useState([]);
    const [events, setEvents] = useState(eventOptions);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [sortBy, setSortBy] = useState('newest');

    useEffect(() => {
        setEvents(eventOptions);
    }, [eventOptions]);

    useEffect(() => {
        fetchOrders();
    }, [page, statusFilter]);

    useEffect(() => {
        if (eventOptions.length > 0) {
            return;
        }

        const fetchEvents = async () => {
            try {
                const response = await api.get('/events?limit=100');
                const payload = response.data?.data?.events || response.data?.events || [];
                setEvents(payload);
            } catch (error) {
                console.error('Failed to fetch events for order filters:', error);
            }
        };

        fetchEvents();
    }, [eventOptions]);

    const fetchOrders = async () => {
        try {
            setIsLoading(true);
            const params = { page, limit: 100 };
            if (statusFilter) params.status = statusFilter;

            const response = await api.get('/orders', { params });
            if (response.data.success) {
                setOrders(response.data.data.orders || []);
                setTotalPages(response.data.data.pagination?.pages || 1);
            }
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredOrders = useMemo(() => {
        const filtered = orders.filter((order) => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchLower || (
                order.orderNumber?.toLowerCase().includes(searchLower)
                || order.user?.email?.toLowerCase().includes(searchLower)
                || order.user?.firstName?.toLowerCase().includes(searchLower)
                || order.user?.lastName?.toLowerCase().includes(searchLower)
                || normalizeEventName(order).toLowerCase().includes(searchLower)
            );
            const matchesEvent = !eventFilter || order.event?.id === eventFilter;

            return matchesSearch && matchesEvent;
        });

        return sortOrders(filtered, sortBy);
    }, [orders, searchTerm, eventFilter, sortBy]);

    const wrapperClassName = embedded
        ? 'space-y-5 animate-fade-in'
        : 'space-y-6 animate-fade-in max-w-7xl mx-auto';

    return (
        <div className={wrapperClassName}>
            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    isDark={isDark}
                    onOrderUpdated={fetchOrders}
                />
            )}

            <div>
                <h2 className={`text-3xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{title}</h2>
                <p className={`mt-1 text-lg font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                    {description}
                </p>
            </div>

            <div className={`p-4 rounded-md border ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col xl:flex-row gap-4 justify-between">
                    <div className="flex-1 relative">
                        <Search className={`absolute left-3 top-2.5 h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <input
                            type="text"
                            placeholder="Search by order, customer, or event..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className={`w-full pl-10 pr-4 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-pink-500 font-light ${isDark
                                ? 'bg-[#151521] border-[#2b2b40] text-gray-200 placeholder-gray-500'
                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                            }`}
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative">
                            <Filter className={`absolute left-3 top-2.5 h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            <select
                                value={eventFilter}
                                onChange={(event) => {
                                    setPage(1);
                                    setEventFilter(event.target.value);
                                }}
                                className={`min-w-[220px] pl-10 pr-8 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-pink-500 appearance-none font-light ${isDark
                                    ? 'bg-[#151521] border-[#2b2b40] text-gray-200'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                            >
                                <option value="">All events</option>
                                {events.map((event) => (
                                    <option key={event.id} value={event.id}>
                                        {event.title || event.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="relative">
                            <Filter className={`absolute left-3 top-2.5 h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            <select
                                value={statusFilter}
                                onChange={(event) => {
                                    setPage(1);
                                    setStatusFilter(event.target.value);
                                }}
                                className={`min-w-[190px] pl-10 pr-8 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-pink-500 appearance-none font-light ${isDark
                                    ? 'bg-[#151521] border-[#2b2b40] text-gray-200'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                            >
                                <option value="">All statuses</option>
                                <option value="PAID">Paid</option>
                                <option value="PENDING">Pending</option>
                                <option value="CANCELLED">Cancelled</option>
                                <option value="REFUNDED">Refunded</option>
                            </select>
                        </div>
                        <div className="relative">
                            <ArrowUpDown className={`absolute left-3 top-2.5 h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            <select
                                value={sortBy}
                                onChange={(event) => setSortBy(event.target.value)}
                                className={`min-w-[190px] pl-10 pr-8 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-pink-500 appearance-none font-light ${isDark
                                    ? 'bg-[#151521] border-[#2b2b40] text-gray-200'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={fetchOrders}
                            className={`p-2 rounded-md transition-colors border ${isDark
                                ? 'bg-[#151521] border-[#2b2b40] text-gray-400 hover:text-gray-200 hover:bg-[#232336] hover:border-[#3a3a5a]'
                                : 'bg-white border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <div className={`overflow-hidden rounded-md border ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                {isLoading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
                        <p className={`mt-4 text-sm font-light ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Loading sales transactions...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="p-20 text-center">
                        <p className={`text-lg font-light ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No transactions found</p>
                        <p className={`text-sm font-light ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Try adjusting your search, event, or status filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-light">
                            <thead className={`text-xs uppercase tracking-wider border-b ${isDark ? 'bg-[#2b2b40] text-[#a1a5b7] border-[#3a3a5a]' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                <tr>
                                    <th className="p-4 font-light tracking-wide">Order #</th>
                                    <th className="p-4 font-light tracking-wide">Customer</th>
                                    <th className="p-4 font-light tracking-wide">Event</th>
                                    <th className="p-4 font-light tracking-wide">Amount</th>
                                    <th className="p-4 font-light tracking-wide">Date</th>
                                    <th className="p-4 font-light tracking-wide">Status</th>
                                    <th className="p-4 font-light tracking-wide text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className={`text-sm divide-y font-light ${isDark ? 'divide-[#2b2b40] text-gray-300' : 'divide-gray-100 text-gray-600'}`}>
                                {filteredOrders.map((order) => (
                                    <tr key={order.id} className={`group transition-colors ${isDark ? 'hover:bg-[#232336]' : 'hover:bg-gray-50'}`}>
                                        <td className="p-4 font-mono">{order.orderNumber}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className={isDark ? 'text-gray-100' : 'text-gray-900'}>{order.user?.firstName} {order.user?.lastName}</span>
                                                <span className="text-xs opacity-60 text-[#a1a5b7]">{order.user?.email}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">{normalizeEventName(order)}</td>
                                        <td className="p-4">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.totalAmount)}
                                        </td>
                                        <td className="p-4 whitespace-nowrap">
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            <StatusBadge status={order.status} isDark={isDark} />
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setSelectedOrder(order)}
                                                className={`p-2 rounded-md transition-all opacity-0 group-hover:opacity-100 ${isDark
                                                    ? 'hover:bg-pink-500/20 text-pink-400'
                                                    : 'hover:bg-pink-50 text-pink-600'
                                                }`}
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!isLoading && orders.length > 0 && totalPages > 1 && (
                    <div className={`p-4 border-t flex justify-between items-center ${isDark ? 'border-[#2b2b40]' : 'border-gray-200'}`}>
                        <div className={`text-sm font-light ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            Page {page} of {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                                disabled={page === 1}
                                className={`p-2 rounded-md transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-[#2b2b40] text-gray-200' : 'hover:bg-gray-100 text-gray-900'}`}
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                                disabled={page === totalPages}
                                className={`p-2 rounded-md transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-[#2b2b40] text-gray-200' : 'hover:bg-gray-100 text-gray-900'}`}
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrdersView;
