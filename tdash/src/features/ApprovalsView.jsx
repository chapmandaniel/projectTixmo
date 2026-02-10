import React, { useState, useEffect } from 'react';
import {
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    Plus,
    Filter,
    Search,
    FileText,
    Eye,
    MoreHorizontal,
    Trash2,
    Edit3,
    Send,
    Users
} from 'lucide-react';
import CreateApprovalModal from './CreateApprovalModal';
import ApprovalDetailView from './ApprovalDetailView';
import { api } from '../lib/api';

const STATUS_CONFIG = {
    DRAFT: { label: 'Draft', color: 'bg-gray-500', textColor: 'text-gray-400', icon: FileText },
    PENDING: { label: 'Pending', color: 'bg-yellow-500', textColor: 'text-yellow-400', icon: Clock },
    APPROVED: { label: 'Approved', color: 'bg-green-500', textColor: 'text-green-400', icon: CheckCircle },
    CHANGES_REQUESTED: { label: 'Changes Requested', color: 'bg-orange-500', textColor: 'text-orange-400', icon: Edit3 },
    REJECTED: { label: 'Rejected', color: 'bg-red-500', textColor: 'text-red-400', icon: XCircle },
};

const PRIORITY_CONFIG = {
    STANDARD: { label: 'Standard', color: 'text-gray-400', bg: 'bg-gray-500/20' },
    URGENT: { label: 'Urgent', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    CRITICAL: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/20' },
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
            const response = await api.get('/events');
            setEvents(response.events || response || []);
        } catch (err) {
            console.error('Failed to fetch events:', err);
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
        approval.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        approval.event?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
        <div className={`min-h-screen p-6 ${isDark ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Approvals
                    </h1>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Manage design and asset approval requests
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Request
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <input
                        type="text"
                        placeholder="Search approvals..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 rounded-lg border ${isDark
                                ? 'bg-[#1A1A1A] border-gray-800 text-white placeholder-gray-500'
                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                            } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                    />
                </div>

                {/* Status Filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={`px-4 py-2 rounded-lg border ${isDark
                            ? 'bg-[#1A1A1A] border-gray-800 text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                >
                    <option value="ALL">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                    ))}
                </select>

                {/* Event Filter */}
                <select
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    className={`px-4 py-2 rounded-lg border ${isDark
                            ? 'bg-[#1A1A1A] border-gray-800 text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                >
                    <option value="">All Events</option>
                    {events.map((event) => (
                        <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                </select>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                    const count = approvals.filter(a => a.status === status).length;
                    const IconComponent = config.icon;
                    return (
                        <div
                            key={status}
                            onClick={() => setStatusFilter(statusFilter === status ? 'ALL' : status)}
                            className={`p-4 rounded-xl cursor-pointer transition-all ${statusFilter === status
                                    ? 'ring-2 ring-indigo-500'
                                    : ''
                                } ${isDark ? 'bg-[#1A1A1A] hover:bg-[#222]' : 'bg-white hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${config.color}/20`}>
                                    <IconComponent className={`w-5 h-5 ${config.textColor}`} />
                                </div>
                                <div>
                                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{count}</p>
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{config.label}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Approvals List */}
            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
            ) : error ? (
                <div className={`text-center py-12 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    {error}
                </div>
            ) : filteredApprovals.length === 0 ? (
                <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No approval requests found</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 text-indigo-500 hover:text-indigo-400"
                    >
                        Create your first request
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredApprovals.map((approval) => {
                        const statusConfig = STATUS_CONFIG[approval.status] || STATUS_CONFIG.DRAFT;
                        const priorityConfig = PRIORITY_CONFIG[approval.priority] || PRIORITY_CONFIG.STANDARD;
                        const StatusIcon = statusConfig.icon;

                        return (
                            <div
                                key={approval.id}
                                onClick={() => setSelectedApproval(approval)}
                                className={`p-4 rounded-xl cursor-pointer transition-all border ${isDark
                                        ? 'bg-[#1A1A1A] border-gray-800 hover:border-gray-700'
                                        : 'bg-white border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        {/* Thumbnail */}
                                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'
                                            }`}>
                                            {approval.assets?.[0]?.s3Url ? (
                                                <img
                                                    src={approval.assets[0].s3Url}
                                                    alt=""
                                                    className="w-full h-full object-cover rounded-lg"
                                                />
                                            ) : (
                                                <FileText className={`w-6 h-6 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {approval.title}
                                                </h3>
                                                {approval.version > 1 && (
                                                    <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                                        v{approval.version}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {approval.event?.name}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${statusConfig.color}/20 ${statusConfig.textColor}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {statusConfig.label}
                                                </span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${priorityConfig.bg} ${priorityConfig.color}`}>
                                                    {priorityConfig.label}
                                                </span>
                                                {approval.reviewers?.length > 0 && (
                                                    <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        <Users className="w-3 h-3" />
                                                        {approval.reviewers.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedApproval(approval);
                                            }}
                                            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                                                }`}
                                        >
                                            <Eye className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

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
