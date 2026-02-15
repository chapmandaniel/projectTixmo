import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, DollarSign, Calendar, User, MoreHorizontal, Download } from 'lucide-react';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';

const OrderRow = ({ order, isDark }) => (
    <tr className={`transition-colors ${isDark ? 'hover:bg-[#252525] border-b border-[#2a2a2a]' : 'hover:bg-gray-50 border-b border-gray-100'}`}>
        <td className={`px-6 py-4 font-mono text-sm ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
            {order.orderNumber}
        </td>
        <td className="px-6 py-4">
            <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 text-xs font-bold ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                    {order.user?.firstName?.[0] || '?'}{order.user?.lastName?.[0] || '?'}
                </div>
                <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{order.user?.firstName} {order.user?.lastName}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{order.user?.email}</p>
                </div>
            </div>
        </td>
        <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {new Date(order.createdAt).toLocaleDateString()}
            <span className="text-xs block opacity-70">{new Date(order.createdAt).toLocaleTimeString()}</span>
        </td>
        <td className="px-6 py-4">
            <StatusBadge status={order.status} isDark={isDark} />
        </td>
        <td className={`px-6 py-4 font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
            ${Number(order.totalAmount).toFixed(2)}
        </td>
        <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {order.tickets?.length || 0} items
        </td>
        <td className="px-6 py-4 text-right">
            <button className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <MoreHorizontal size={16} />
            </button>
        </td>
    </tr>
);

const ECC_Orders = ({ event, isDark }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [total, setTotal] = useState(0);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/orders?eventId=${event.id}&page=${page}&limit=${limit}`);
            // Check for wrapped response structure
            const data = res.data.data ? res.data.data.orders : (res.data.orders || []);
            const meta = res.data.data ? res.data.data.pagination : (res.data.pagination || {});

            setOrders(Array.isArray(data) ? data : []);
            setTotal(meta.total || 0);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [event.id, page]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className={`relative w-full md:w-96 flex items-center px-4 py-2.5 rounded-xl border transition-colors ${isDark ? 'bg-[#1e1e1e] border-[#333] focus-within:border-indigo-500' : 'bg-white border-gray-200 focus-within:border-indigo-500 shadow-sm'}`}>
                    <Search size={18} className={`mr-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <input
                        type="text"
                        placeholder="Search order #, name, email..."
                        className={`w-full bg-transparent outline-none text-sm ${isDark ? 'text-gray-200 placeholder-gray-600' : 'text-gray-800 placeholder-gray-400'}`}
                    />
                </div>

                <div className="flex space-x-3 w-full md:w-auto">
                    <button className={`flex-1 md:flex-none px-4 py-2.5 text-sm font-medium rounded-xl flex items-center justify-center border transition-colors ${isDark ? 'bg-[#1e1e1e] border-[#333] text-gray-300 hover:bg-[#252525]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'
                        }`}>
                        <Filter size={16} className="mr-2" /> Filter
                    </button>
                    <button className={`flex-1 md:flex-none px-4 py-2.5 text-sm font-medium rounded-xl flex items-center justify-center border transition-colors ${isDark ? 'bg-[#1e1e1e] border-[#333] text-gray-300 hover:bg-[#252525]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'
                        }`}>
                        <Download size={16} className="mr-2" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Table Card */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className={`text-xs uppercase font-semibold ${isDark ? 'bg-[#252525] text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                            <tr>
                                <th className="px-6 py-4">Order #</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4">Items</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`${isDark ? 'divide-[#2a2a2a]' : 'divide-gray-100'}`}>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className={`h-4 w-24 rounded ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                        <td className="px-6 py-4"><div className={`h-4 w-32 rounded ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                        <td className="px-6 py-4"><div className={`h-4 w-20 rounded ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                        <td className="px-6 py-4"><div className={`h-6 w-16 rounded-full ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                        <td className="px-6 py-4"><div className={`h-4 w-16 rounded ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                        <td className="px-6 py-4"><div className={`h-4 w-12 rounded ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                        <td className="px-6 py-4 text-right"><div className={`h-8 w-8 ml-auto rounded ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className={`px-6 py-12 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <div className="flex flex-col items-center justify-center">
                                            <div className={`p-4 rounded-full mb-3 ${isDark ? 'bg-[#252525]' : 'bg-gray-100'}`}>
                                                <DollarSign size={24} />
                                            </div>
                                            <p className="font-medium mb-1">No orders found</p>
                                            <p className="text-xs">Orders will appear here once ticket sales begin.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                orders.map(order => (
                                    <OrderRow key={order.id} order={order} isDark={isDark} />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > limit && (
                    <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-[#333]' : 'border-gray-100'}`}>
                        <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} orders
                        </span>
                        <div className="flex space-x-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                                className={`px-3 py-1 text-sm rounded-lg transition-colors ${isDark
                                        ? 'bg-[#252525] text-gray-300 hover:bg-[#333] disabled:opacity-50'
                                        : 'bg-white border text-gray-600 hover:bg-gray-50 disabled:opacity-50'
                                    }`}
                            >
                                Previous
                            </button>
                            <button
                                disabled={page * limit >= total}
                                onClick={() => setPage(page + 1)}
                                className={`px-3 py-1 text-sm rounded-lg transition-colors ${isDark
                                        ? 'bg-[#252525] text-gray-300 hover:bg-[#333] disabled:opacity-50'
                                        : 'bg-white border text-gray-600 hover:bg-gray-50 disabled:opacity-50'
                                    }`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ECC_Orders;
