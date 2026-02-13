import React, { useState, useEffect } from 'react';
import {
    CheckCircle,
    Clock,
    XCircle,
    Plus,
    Search,
    FileText,
    Edit3,
    Calendar,
    ChevronDown
} from 'lucide-react';
import ApprovalCard from '../components/ApprovalCard';
import CreateApprovalModal from './CreateApprovalModal';
import ApprovalDetailView from './ApprovalDetailView';
import { api } from '../lib/api';

const STATUS_CONFIG = {
    DRAFT: { label: 'Draft', color: 'bg-gray-500', textColor: 'text-gray-400', icon: FileText },
    PENDING: { label: 'Pending', color: 'bg-yellow-500', textColor: 'text-yellow-400', icon: Clock },
    APPROVED: { label: 'Approved', color: 'bg-green-500', textColor: 'text-green-400', icon: CheckCircle },
    CHANGES_REQUESTED: { label: 'Changes', color: 'bg-orange-500', textColor: 'text-orange-400', icon: Edit3 },
    REJECTED: { label: 'Rejected', color: 'bg-red-500', textColor: 'text-red-400', icon: XCircle },
};

const ApprovalsView = ({ isDark, user }) => {
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedApproval, setSelectedApproval] = useState(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [events, setEvents] = useState([]);
    const [eventFilter, setEventFilter] = useState('');

    useEffect(() => {
        fetchApprovals();
        fetchEvents();
    }, [statusFilter, eventFilter]);

    const fetchApprovals = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') {
                params.append('status', statusFilter);
            }
            if (eventFilter) {
                params.append('eventId', eventFilter);
            }
            const response = await api.get(`/approvals?${params.toString()}`);
            setApprovals(response.approvals || []);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch approvals:', err);
            setError('Failed to load approvals');
        } finally {
            setLoading(false);
        }
    };

    const fetchEvents = async () => {
        try {
            const response = await api.get('/events?limit=100'); // Fetch all events for dropdown
            // API returns { success: true, data: { events: [], pagination: {} } }
            // api.get unwraps 'data', so response is { events: [], pagination: {} }
            const eventsList = response.events || response.data?.events || [];
            setEvents(Array.isArray(eventsList) ? eventsList : []);
        } catch (err) {
            console.error('Failed to fetch events:', err);
            setEvents([]);
        }
    };

    const handleApprovalCreated = (newApproval) => {
        setApprovals([newApproval, ...approvals]);
        setShowCreateModal(false);
    };

    const handleApprovalUpdated = (updatedApproval) => {
        setApprovals(approvals.map(a => a.id === updatedApproval.id ? updatedApproval : a));
        setSelectedApproval(updatedApproval);
    };

    const handleDeleteApproval = async (approvalId) => {
        if (!confirm('Are you sure you want to delete this approval request?')) return;

        try {
            await api.delete(`/approvals/${approvalId}`);
            setApprovals(approvals.filter(a => a.id !== approvalId));
            setSelectedApproval(null);
        } catch (err) {
            console.error('Failed to delete approval:', err);
        }
    };

    const filteredApprovals = approvals.filter(approval =>
        (approval.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (approval.event?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedEventName = events.find(e => e.id === eventFilter)?.name;

    // If viewing detail
    if (selectedApproval) {
        return (
            <ApprovalDetailView
                approval={selectedApproval}
                isDark={isDark}
                user={user}
                onBack={() => setSelectedApproval(null)}
                onUpdate={handleApprovalUpdated}
                onDelete={() => handleDeleteApproval(selectedApproval.id)}
            />
        );
    }

    return (
        <div className={`min-h-screen ${isDark ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
            {/* ── Event Selector Bar ── */}
            <div className={`sticky top-0 z-10 border-b ${isDark ? 'bg-[#0A0A0A]/95 backdrop-blur-xl border-gray-800/60' : 'bg-white/95 backdrop-blur-xl border-gray-200'}`}>
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Approvals
                            </h1>
                            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                Review and approve creative submissions
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 font-medium text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            New Request
                        </button>
                    </div>

                    {/* Event Selector Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                            onClick={() => setEventFilter('')}
                            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${!eventFilter
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                                : isDark
                                    ? 'bg-[#1A1A1A] text-gray-400 hover:bg-[#222] hover:text-gray-300 border border-gray-800'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" />
                                All Events
                            </div>
                        </button>
                        {Array.isArray(events) && events.map((event) => (
                            <button
                                key={event.id}
                                onClick={() => setEventFilter(eventFilter === event.id ? '' : event.id)}
                                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${eventFilter === event.id
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                                    : isDark
                                        ? 'bg-[#1A1A1A] text-gray-400 hover:bg-[#222] hover:text-gray-300 border border-gray-800'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                    }`}
                            >
                                {event.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Filters Row ── */}
            <div className="px-6 pt-5 pb-2">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                        <input
                            type="text"
                            placeholder="Search submissions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm ${isDark
                                ? 'bg-[#1A1A1A] border-gray-800 text-white placeholder-gray-600'
                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                                } focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all`}
                        />
                    </div>

                    {/* Status Filter Pills */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setStatusFilter('ALL')}
                            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${statusFilter === 'ALL'
                                ? isDark
                                    ? 'bg-white/10 text-white'
                                    : 'bg-gray-900 text-white'
                                : isDark
                                    ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            All
                        </button>
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                            const StatusIcon = config.icon;
                            const count = approvals.filter(a => a?.status === key).length;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setStatusFilter(statusFilter === key ? 'ALL' : key)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${statusFilter === key
                                        ? `${config.color}/20 ${config.textColor}`
                                        : isDark
                                            ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {config.label}
                                    {count > 0 && (
                                        <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${statusFilter === key
                                            ? `${config.color}/30`
                                            : isDark ? 'bg-gray-800' : 'bg-gray-200'
                                            }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Gallery Grid ── */}
            <div className="px-6 py-4">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
                            <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Loading submissions...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className={`text-center py-20 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                        <p className="text-lg font-medium">{error}</p>
                        <button
                            onClick={fetchApprovals}
                            className="mt-3 text-sm text-indigo-500 hover:text-indigo-400 transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                ) : filteredApprovals.length === 0 ? (
                    <div className={`text-center py-20`}>
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
                            <FileText className={`w-8 h-8 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                        </div>
                        <p className={`text-lg font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            No approval requests found
                        </p>
                        <p className={`text-sm mb-5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                            {eventFilter
                                ? `No submissions for ${selectedEventName || 'this event'} yet`
                                : 'Get started by creating your first approval request'
                            }
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 font-medium text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Create Request
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {filteredApprovals.map((approval) => (
                            <ApprovalCard
                                key={approval.id}
                                approval={approval}
                                isDark={isDark}
                                onClick={() => setSelectedApproval(approval)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <CreateApprovalModal
                    isDark={isDark}
                    events={events}
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleApprovalCreated}
                />
            )}
        </div>
    );
};

export default ApprovalsView;
