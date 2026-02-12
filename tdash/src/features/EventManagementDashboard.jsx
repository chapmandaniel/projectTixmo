import React, { useState } from 'react';
import {
    ArrowLeft, Edit3, Download, Calendar, MapPin, Plus, MoreHorizontal, Search, Filter, UserCheck, UserX, AlertTriangle, Trash2, Globe, ArrowUp, ArrowDown, Copy, XCircle
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { MOCK_ANALYTICS_DATA, MOCK_GUESTS, COLORS, DARK_COLORS } from '../data/mockData';
import api from '../lib/api';
import TicketTypeModal from './TicketTypeModal';
import EventWizard from './EventWizard';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, eventName, isDark, loading, error }) => {
    const [confirmText, setConfirmText] = useState('');
    const isMatched = confirmText === 'DELETE';

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl scale-100 transition-all ${isDark ? 'bg-[#1e1e1e] border border-[#333]' : 'bg-white'}`}>
                <div className="flex items-center space-x-3 mb-4 text-rose-500">
                    <AlertTriangle size={24} />
                    <h3 className="text-xl font-semibold">Delete Event</h3>
                </div>

                <p className={`mb-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Are you sure you want to delete <strong>{eventName}</strong>? This action will move the event to the recycling bin.
                </p>

                <div className="mb-6">
                    <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        Type <strong>DELETE</strong> to confirm
                    </label>
                    <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg outline-none border transition-colors ${isDark
                            ? 'bg-[#252525] border-[#333] text-white focus:border-rose-500'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-rose-500'
                            }`}
                        placeholder="DELETE"
                    />
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center space-x-2 text-rose-500 text-sm">
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#333]' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!isMatched || loading}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-lg ${isMatched
                            ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-500/20'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                            }`}
                    >
                        {loading ? 'Deleting...' : 'Delete Event'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SimpleDeleteModal = ({ isOpen, onClose, onConfirm, title, message, isDark, loading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-sm p-6 rounded-xl shadow-2xl scale-100 transition-all ${isDark ? 'bg-[#1e1e1e] border border-[#333]' : 'bg-white'}`}>
                <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{title}</h3>
                <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {message}
                </p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#333]' : 'text-gray-600 hover:bg-gray-100'}`}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-lg shadow-rose-500/20"
                    >
                        {loading ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const EventManagementDashboard = ({ event, onBack, isDark, user, onUpdate }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isCloning, setIsCloning] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [eventData, setEventData] = useState(event); // Use local state for event data

    // If event prop changes, update local state
    React.useEffect(() => {
        setEventData(event);
    }, [event]);

    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [showEditWizard, setShowEditWizard] = useState(false);


    // Fallbacks for missing data
    const safeEvent = {
        ...eventData,
        revenue: eventData.revenue ?? 0,
        sold: eventData.sold ?? 0,
        capacity: eventData.capacity ?? 0
    };

    const [ticketTypes, setTicketTypes] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [sortBy, setSortBy] = useState('price');
    const [sortOrder, setSortOrder] = useState('asc');

    // Ticket handling state
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [editingTicketType, setEditingTicketType] = useState(null);

    // Delete ticket state
    const [showDeleteTicketModal, setShowDeleteTicketModal] = useState(false);
    const [ticketToDelete, setTicketToDelete] = useState(null);
    const [deleteTicketLoading, setDeleteTicketLoading] = useState(false);

    // Fetch ticket types when tab changes to 'tickets'
    React.useEffect(() => {
        if (activeTab === 'tickets') {
            fetchTicketTypes();
        }
    }, [activeTab, eventData.id, sortBy, sortOrder]); // Add eventData.id to dependency array

    const fetchTicketTypes = async () => {
        setLoadingTickets(true);
        try {
            const res = await api.get(`/ticket-types?eventId=${eventData.id}&sortBy=${sortBy}&sortOrder=${sortOrder}`);
            // Check for wrapped response structure
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setTicketTypes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch ticket types:', error);
            // Don't clear tickets on error, just stop loading
        } finally {
            setLoadingTickets(false);
        }
    };

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    const handleCreateTicket = () => {
        setEditingTicketType(null);
        setShowTicketModal(true);
    };

    const handleEditTicket = (ticket) => {
        setEditingTicketType(ticket);
        setShowTicketModal(true);
    };

    const confirmDeleteTicket = (ticket) => {
        setTicketToDelete(ticket);
        setShowDeleteTicketModal(true);
    };

    const handleDeleteTicket = async () => {
        if (!ticketToDelete) return;
        setDeleteTicketLoading(true);
        try {
            await api.delete(`/ticket-types/${ticketToDelete.id}`);
            await fetchTicketTypes();
            setShowDeleteTicketModal(false);
            setTicketToDelete(null);
        } catch (error) {
            console.error('Failed to delete ticket type:', error);
            // Ideally show error in a toast or alert, for now console log
            alert('Failed to delete ticket type: ' + (error.response?.data?.message || error.message));
        } finally {
            setDeleteTicketLoading(false);
        }
    };

    const handleDelete = async () => {
        setDeleteError('');
        try {
            setDeleteLoading(true);
            await api.delete(`/events/${eventData.id}`);
            setDeleteLoading(false);
            setShowDeleteModal(false);
            onBack();
        } catch (error) {
            console.error('Failed to delete event:', error);
            setDeleteLoading(false);
            setDeleteError(error.response?.data?.message || 'Failed to delete event');
        }
    }

    const handleCloneEvent = async () => {
        setIsCloning(true);
        try {
            const res = await api.post(`/events/${eventData.id}/clone`);
            if (onUpdate) onUpdate(res.data.data); // Assuming onUpdate can handle a new event
            // Optionally navigate to the new event's dashboard or show a success message
            alert('Event cloned successfully!');
        } catch (error) {
            console.error('Failed to clone event:', error);
            alert('Failed to clone event: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsCloning(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        setStatusUpdating(true);
        try {
            const res = await api.patch(`/events/${eventData.id}/status`, { status: newStatus });
            setEventData(res.data.data); // Update local event state
            if (onUpdate) onUpdate(res.data.data); // Notify parent
            alert(`Event status updated to ${newStatus}!`);
        } catch (error) {
            console.error(`Failed to update event status to ${newStatus}:`, error);
            alert(`Failed to update event status: ` + (error.response?.data?.message || error.message));
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleUpdateSuccess = (updatedEvent) => {
        setShowEditWizard(false);
        setEventData(updatedEvent); // Update local event state
        if (onUpdate) {
            onUpdate(updatedEvent);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'tickets', label: 'Ticket Types' },
        { id: 'guests', label: 'Guest List' },
        { id: 'settings', label: 'Settings' },
    ];

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {showEditWizard && (
                <EventWizard
                    initialData={eventData}
                    onClose={() => setShowEditWizard(false)}
                    onSuccess={handleUpdateSuccess}
                    isDark={isDark}
                    user={user}
                />
            )}
            {/* Header */}
            <div className="flex flex-col space-y-4">
                <button
                    onClick={onBack}
                    className={`flex items-center space-x-2 text-sm ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                >
                    <ArrowLeft size={16} />
                    <span>Back to Events</span>
                </button>

                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center space-x-3 mb-1">
                            <h1 className={`text-2xl font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{eventData.name}</h1>
                            <StatusBadge status={eventData.status} isDark={isDark} />
                        </div>
                        <div className={`flex items-center space-x-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            <span className="flex items-center"><Calendar size={14} className="mr-1.5" /> {(eventData.startDatetime) ? new Date(eventData.startDatetime).toLocaleDateString() : 'Date TBA'}</span>
                            <span className="flex items-center"><MapPin size={14} className="mr-1.5" /> {eventData.venue?.name || (typeof eventData.venue === 'string' ? eventData.venue : 'Venue TBA')}</span>
                        </div>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={handleCloneEvent}
                            disabled={isCloning}
                            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                            title="Clone Event"
                        >
                            <Copy size={20} />
                        </button>
                        <button
                            onClick={() => setShowEditWizard(true)}
                            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                            title="Edit Event"
                        >
                            <Edit3 size={20} />
                        </button>
                        <button className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center shadow-lg ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}`}>
                            <Download size={16} className="mr-2" /> Export
                        </button>
                        {eventData.status === 'DRAFT' ? (
                            <button
                                onClick={() => handleStatusChange('PUBLISHED')}
                                disabled={statusUpdating}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                                    }`}
                            >
                                <Globe size={16} />
                                <span>{statusUpdating ? 'Publishing...' : 'Publish Event'}</span>
                            </button>
                        ) : (
                            <div className="flex space-x-2">
                                {eventData.status !== 'CANCELLED' && (
                                    <button
                                        onClick={() => handleStatusChange('CANCELLED')}
                                        disabled={statusUpdating}
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
                                            : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                                            }`}
                                    >
                                        <XCircle size={16} />
                                        <span>Cancel Event</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className={`flex items-center space-x-6 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-200'}`}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-3 text-sm font-medium relative transition-colors ${activeTab === tab.id
                                ? (isDark ? 'text-white' : 'text-indigo-600')
                                : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-800')
                                }`}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className={`absolute bottom-0 left-0 w-full h-0.5 ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'}`}></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <StatCard
                                title="Total Revenue"
                                value={`$${Number(eventData.revenue || 0).toLocaleString()}`}
                                trend="15% vs last week"
                                trendUp={true}
                                isDark={isDark}
                            />
                            <div className={`${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'} p-5 rounded-xl`}>
                                <h3 className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm font-normal mb-3`}>Tickets Sold</h3>
                                <div className="flex items-end justify-between mb-2">
                                    <p className={`${isDark ? 'text-gray-200' : 'text-gray-700'} text-3xl font-medium tracking-tight`}>{Number(eventData.sold || 0).toLocaleString()}</p>
                                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>of {Number(eventData.capacity || 0).toLocaleString()}</span>
                                </div>
                                <div className={`w-full rounded-full h-1.5 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                                    <div
                                        className={`h-1.5 rounded-full ${isDark ? 'bg-emerald-500' : 'bg-emerald-600'}`}
                                        style={{ width: `${(eventData.sold / eventData.capacity) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            <StatCard
                                title="Page Views"
                                value="45.2k"
                                trend="5.2% vs last week"
                                trendUp={true}
                                isDark={isDark}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div className={`${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'} p-5 rounded-xl`}>
                                <h3 className={`text-lg font-medium mb-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Sales Velocity</h3>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={MOCK_ANALYTICS_DATA}>
                                            <defs>
                                                <linearGradient id="colorSalesM" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={isDark ? '#6366f1' : '#374151'} stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor={isDark ? '#6366f1' : '#374151'} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2a2a2a' : '#f3f4f6'} />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#525252' : '#9ca3af', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#525252' : '#9ca3af', fontSize: 12 }} />
                                            <Tooltip contentStyle={{ backgroundColor: isDark ? '#252525' : '#fff', borderRadius: '8px', border: 'none' }} />
                                            <Area type="monotone" dataKey="sales" stroke={isDark ? '#6366f1' : '#374151'} strokeWidth={2} fillOpacity={1} fill="url(#colorSalesM)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={`${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'} p-5 rounded-xl`}>
                                <h3 className={`text-lg font-medium mb-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Sales by Type</h3>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={ticketTypes.length > 0 ? ticketTypes.map(t => ({ name: t.name, value: t.sold || 0 })) : [{ name: 'No Data', value: 1 }]}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {ticketTypes.length > 0 ? ticketTypes.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={isDark ? DARK_COLORS[index % DARK_COLORS.length] : COLORS[index % COLORS.length]} strokeWidth={0} />
                                                )) : <Cell fill={isDark ? '#333' : '#eee'} />}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: isDark ? '#252525' : '#fff', borderRadius: '8px', border: 'none' }} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'tickets' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-end">
                            <button
                                onClick={handleCreateTicket}
                                className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center shadow-lg ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}`}
                            >
                                <Plus size={16} className="mr-2" /> Add Ticket Type
                            </button>
                        </div>
                        <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
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
                                        {ticketTypes.length === 0 ? (
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
                                                                onClick={() => handleEditTicket(ticket)}
                                                                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`}
                                                                title="Edit"
                                                            >
                                                                <Edit3 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => confirmDeleteTicket(ticket)}
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
                    </div>
                )}

                {activeTab === 'guests' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <div className={`flex items-center px-3 py-2 rounded-lg border ${isDark ? 'bg-[#252525] border-[#333]' : 'bg-white border-gray-200'}`}>
                                <Search size={16} className={`mr-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                <input
                                    type="text"
                                    placeholder="Search guests..."
                                    className={`bg-transparent outline-none text-sm ${isDark ? 'text-gray-200 placeholder-gray-600' : 'text-gray-800 placeholder-gray-400'}`}
                                />
                            </div>
                            <button className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center transition-colors ${isDark ? 'bg-[#252525] text-gray-300 hover:bg-[#2a2a2a]' : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'}`}>
                                <Filter size={16} className="mr-2" /> Filter
                            </button>
                        </div>
                        <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
                            <div className="overflow-x-auto">
                                <table className={`w-full text-left text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <thead className={`${isDark ? 'bg-[#252525] text-gray-500' : 'bg-gray-50 text-gray-400'} text-xs uppercase font-normal`}>
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Name</th>
                                            <th className="px-6 py-3 font-medium">Ticket Type</th>
                                            <th className="px-6 py-3 font-medium">Status</th>
                                            <th className="px-6 py-3 font-medium">Check-in Time</th>
                                            <th className="px-6 py-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${isDark ? 'divide-[#252525]' : 'divide-gray-50'}`}>
                                        {MOCK_GUESTS.map((guest) => (
                                            <tr key={guest.id} className={`transition-colors ${isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-50'}`}>
                                                <td className={`px-6 py-4 font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{guest.name}</td>
                                                <td className="px-6 py-4">{guest.type}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${guest.status === 'Checked In' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700') : (isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600')}`}>
                                                        {guest.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{guest.time}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end space-x-2">
                                                        <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400' : 'hover:bg-emerald-50 text-gray-400 hover:text-emerald-600'}`} title="Check In">
                                                            <UserCheck size={16} />
                                                        </button>
                                                        <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-rose-500/10 text-gray-500 hover:text-rose-400' : 'hover:bg-rose-50 text-gray-400 hover:text-rose-600'}`} title="Revoke">
                                                            <UserX size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="space-y-8 animate-fade-in max-w-4xl">
                        {/* General Settings */}
                        <div className={`p-6 rounded-xl ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
                            <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>General Settings</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Event Name</label>
                                    <input
                                        type="text"
                                        defaultValue={event.name}
                                        className={`w-full px-4 py-2 rounded-lg outline-none border ${isDark ? 'bg-[#252525] border-[#333] text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Event Category</label>
                                    <input
                                        type="text"
                                        defaultValue={event.category}
                                        className={`w-full px-4 py-2 rounded-lg outline-none border ${isDark ? 'bg-[#252525] border-[#333] text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className={`p-6 rounded-xl border border-rose-500/20 ${isDark ? 'bg-rose-500/5' : 'bg-rose-50'}`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-medium text-rose-500 mb-1">Danger Zone</h3>
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Delete this event and remove it from public view. This action can be undone from the main settings.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-lg shadow-rose-500/20"
                                >
                                    Delete Event
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <TicketTypeModal
                isOpen={showTicketModal}
                onClose={() => setShowTicketModal(false)}
                eventId={event.id}
                isDark={isDark}
                onSuccess={fetchTicketTypes}
                initialData={editingTicketType}
            />

            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                eventName={event.name}
                isDark={isDark}
                loading={deleteLoading}
                error={deleteError}
            />

            <SimpleDeleteModal
                isOpen={showDeleteTicketModal}
                onClose={() => setShowDeleteTicketModal(false)}
                onConfirm={handleDeleteTicket}
                title="Delete Ticket Type"
                message={`Are you sure you want to delete "${ticketToDelete?.name}"? Data including sales history will be preserved in database but this ticket won't be visible/purchasable.`}
                isDark={isDark}
                loading={deleteTicketLoading}
            />
        </div>
    );
};

export default EventManagementDashboard;
