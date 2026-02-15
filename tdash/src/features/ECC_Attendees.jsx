import React, { useState, useEffect } from 'react';
import { Search, Filter, User, CheckCircle, XCircle, MoreHorizontal, Download, UserCheck, UserX } from 'lucide-react';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';

const AttendeeRow = ({ ticket, isDark, onCheckIn, onRevoke }) => (
    <tr className={`transition-colors ${isDark ? 'hover:bg-[#252525] border-b border-[#2a2a2a]' : 'hover:bg-gray-50 border-b border-gray-100'}`}>
        <td className="px-6 py-4">
            <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 text-xs font-bold ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                    {ticket.user?.firstName?.[0] || '?'}{ticket.user?.lastName?.[0] || '?'}
                </div>
                <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{ticket.user?.firstName} {ticket.user?.lastName}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{ticket.user?.email}</p>
                </div>
            </div>
        </td>
        <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {ticket.ticketType?.name || 'Unknown Ticket'}
        </td>
        <td className="px-6 py-4">
            {ticket.status === 'USED' ? (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                    <CheckCircle size={12} className="mr-1" /> Checked In
                </span>
            ) : ticket.status === 'VALID' ? (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'}`}>
                    Confirmed
                </span>
            ) : (
                <StatusBadge status={ticket.status} isDark={isDark} />
            )}
        </td>
        <td className={`px-6 py-4 text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {ticket.order?.orderNumber}
        </td>
        <td className="px-6 py-4 text-right">
            <div className="flex justify-end space-x-2">
                {ticket.status === 'VALID' && (
                    <button
                        onClick={() => onCheckIn(ticket)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400' : 'hover:bg-emerald-50 text-gray-500 hover:text-emerald-600'}`}
                        title="Check In"
                    >
                        <UserCheck size={16} />
                    </button>
                )}
                {ticket.status === 'USED' && (
                    <button
                        title="Already Checked In"
                        className={`p-2 rounded-lg cursor-default opacity-50 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                    >
                        <CheckCircle size={16} />
                    </button>
                )}
                <button className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                    <MoreHorizontal size={16} />
                </button>
            </div>
        </td>
    </tr>
);

const ECC_Attendees = ({ event, isDark }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [total, setTotal] = useState(0);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/tickets?eventId=${event.id}&page=${page}&limit=${limit}&sortBy=createdAt`);
            // Check for wrapped response structure
            const data = res.data.data ? res.data.data.tickets : (res.data.tickets || []);
            const meta = res.data.data ? res.data.data.pagination : (res.data.pagination || {});

            setTickets(Array.isArray(data) ? data : []);
            setTotal(meta.total || 0);
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [event.id, page]);

    const handleCheckIn = async (ticket) => {
        // Optimistic update
        const originalTickets = [...tickets];
        setTickets(tickets.map(t => t.id === ticket.id ? { ...t, status: 'USED' } : t));

        try {
            await api.post(`/tickets/check-in`, { barcode: ticket.barcode });
            // Success
        } catch (error) {
            console.error('Check-in failed:', error);
            // Revert
            setTickets(originalTickets);
            alert('Check-in failed: ' + (error.response?.data?.message || error.message));
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className={`relative w-full md:w-96 flex items-center px-4 py-2.5 rounded-xl border transition-colors ${isDark ? 'bg-[#1e1e1e] border-[#333] focus-within:border-indigo-500' : 'bg-white border-gray-200 focus-within:border-indigo-500 shadow-sm'}`}>
                    <Search size={18} className={`mr-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <input
                        type="text"
                        placeholder="Search guest name, email, order #..."
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
                        <Download size={16} className="mr-2" /> Export List
                    </button>
                </div>
            </div>

            {/* Table Card */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className={`text-xs uppercase font-semibold ${isDark ? 'bg-[#252525] text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                            <tr>
                                <th className="px-6 py-4">Guest</th>
                                <th className="px-6 py-4">Ticket Type</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Order #</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`${isDark ? 'divide-[#2a2a2a]' : 'divide-gray-100'}`}>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className={`h-8 w-32 rounded ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                        <td className="px-6 py-4"><div className={`h-4 w-24 rounded ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                        <td className="px-6 py-4"><div className={`h-6 w-20 rounded-full ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                        <td className="px-6 py-4"><div className={`h-4 w-16 rounded ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                        <td className="px-6 py-4 text-right"><div className={`h-8 w-8 ml-auto rounded ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div></td>
                                    </tr>
                                ))
                            ) : tickets.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className={`px-6 py-12 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <div className="flex flex-col items-center justify-center">
                                            <div className={`p-4 rounded-full mb-3 ${isDark ? 'bg-[#252525]' : 'bg-gray-100'}`}>
                                                <User size={24} />
                                            </div>
                                            <p className="font-medium mb-1">No attendees found</p>
                                            <p className="text-xs">Guest list will populate as tickets are sold.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                tickets.map(ticket => (
                                    <AttendeeRow
                                        key={ticket.id}
                                        ticket={ticket}
                                        isDark={isDark}
                                        onCheckIn={handleCheckIn}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > limit && (
                    <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-[#333]' : 'border-gray-100'}`}>
                        <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} attendees
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

export default ECC_Attendees;
