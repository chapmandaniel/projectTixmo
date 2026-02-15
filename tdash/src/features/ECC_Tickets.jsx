import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import TicketTypeModal from './TicketTypeModal';
import { COLORS, DARK_COLORS } from '../data/mockData';

const ECC_Tickets = ({ event, isDark }) => {
    const [ticketTypes, setTicketTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('price');
    const [sortOrder, setSortOrder] = useState('asc');

    // Modal State
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [editingTicketType, setEditingTicketType] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [ticketToDelete, setTicketToDelete] = useState(null);

    const fetchTicketTypes = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/ticket-types?eventId=${event.id}&sortBy=${sortBy}&sortOrder=${sortOrder}`);
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setTicketTypes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch ticket types:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTicketTypes();
    }, [event.id, sortBy, sortOrder]);

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    const handleCreate = () => {
        setEditingTicketType(null);
        setShowTicketModal(true);
    };

    const handleEdit = (ticket) => {
        setEditingTicketType(ticket);
        setShowTicketModal(true);
    };

    const handleDeleteClick = (ticket) => {
        setTicketToDelete(ticket);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!ticketToDelete) return;
        try {
            await api.delete(`/ticket-types/${ticketToDelete.id}`);
            fetchTicketTypes();
            setShowDeleteModal(false);
            setTicketToDelete(null);
        } catch (error) {
            console.error('Failed to delete ticket type:', error);
            alert('Failed to delete: ' + (error.response?.data?.message || error.message));
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Actions */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className={`text-lg font-medium ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>Ticket Classes</h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Manage ticket types and pricing tiers for this event.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center shadow-lg transition-all ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}`}
                >
                    <Plus size={16} className="mr-2" /> Add Ticket Type
                </button>
            </div>

            {/* Table Card */}
            <div className={`rounded-xl overflow-hidden border ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="overflow-x-auto">
                    <table className={`w-full text-left text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <thead className={`${isDark ? 'bg-[#252525] text-gray-500' : 'bg-gray-50 text-gray-400'} text-xs uppercase font-normal`}>
                            <tr>
                                <th className="px-6 py-3 font-medium cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => handleSort('name')}>
                                    <div className="flex items-center space-x-1">
                                        <span>Name</span>
                                        {sortBy === 'name' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-6 py-3 font-medium cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => handleSort('price')}>
                                    <div className="flex items-center space-x-1">
                                        <span>Price</span>
                                        {sortBy === 'price' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-6 py-3 font-medium cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => handleSort('sold')}>
                                    <div className="flex items-center space-x-1">
                                        <span>Sold / Total</span>
                                        {sortBy === 'sold' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-6 py-3 font-medium cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => handleSort('status')}>
                                    <div className="flex items-center space-x-1">
                                        <span>Status</span>
                                        {sortBy === 'status' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-[#252525]' : 'divide-gray-50'}`}>
                            {loading ? (
                                <tr><td colSpan="5" className="px-6 py-8 text-center">Loading...</td></tr>
                            ) : ticketTypes.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center opacity-50">
                                        No ticket types found. Create one to get started.
                                    </td>
                                </tr>
                            ) : (
                                ticketTypes.map((ticket) => (
                                    <tr key={ticket.id} className={`transition-colors ${isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-50'}`}>
                                        <td className={`px-6 py-4 font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{ticket.name}</td>
                                        <td className="px-6 py-4">${Number(ticket.price).toFixed(2)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-2">
                                                <div className={`w-24 h-1.5 rounded-full ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                                                    <div className={`h-1.5 rounded-full ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'}`} style={{ width: `${((ticket.sold || 0) / ticket.quantity) * 100}%` }}></div>
                                                </div>
                                                <span className="text-xs">{ticket.sold || 0} / {ticket.quantity}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={ticket.status || 'ACTIVE'} isDark={isDark} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => handleEdit(ticket)}
                                                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`}
                                                    title="Edit"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(ticket)}
                                                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-rose-500/10 text-gray-400 hover:text-rose-500' : 'hover:bg-rose-50 text-gray-500 hover:text-rose-600'}`}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <TicketTypeModal
                isOpen={showTicketModal}
                onClose={() => setShowTicketModal(false)}
                eventId={event.id}
                isDark={isDark}
                onSuccess={fetchTicketTypes}
                initialData={editingTicketType}
            />

            {/* Simple Delete Modal Inline */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className={`w-full max-w-sm p-6 rounded-xl shadow-2xl scale-100 transition-all ${isDark ? 'bg-[#1e1e1e] border border-[#333]' : 'bg-white'}`}>
                        <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Delete Ticket Type</h3>
                        <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Are you sure you want to delete <strong>{ticketToDelete?.name}</strong>?
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#333]' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-lg shadow-rose-500/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ECC_Tickets;
