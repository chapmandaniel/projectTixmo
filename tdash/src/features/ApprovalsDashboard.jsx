import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Filter,
    Calendar,
    LayoutGrid,
    List as ListIcon,
    Inbox,
    Clock,
    CheckCircle,
    Edit3,
    XCircle,
    Eye,
    ChevronDown,
    Paperclip
} from 'lucide-react';
import ApprovalGalleryCard from './ApprovalGalleryCard';
import CreateApprovalModal from './CreateApprovalModal';
import ApprovalDetailView from './ApprovalDetailView';
import { api } from '../lib/api';

const STATUS_ICONS = {
    DRAFT: Clock,
    PENDING: Eye,
    CHANGES_REQUESTED: Edit3,
    APPROVED: CheckCircle,
    REJECTED: XCircle
};

const ApprovalsDashboard = ({ isDark, user }) => {
    const [currentTab, setCurrentTab] = useState('active'); // 'active' | 'history'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [events, setEvents] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedApproval, setSelectedApproval] = useState(null);

    // Derived state
    const [displayApprovals, setDisplayApprovals] = useState([]);

    // Initial Data Fetch
    useEffect(() => {
        fetchInitialData();
    }, []);

    // Re-fetch approvals when event filter changes
    useEffect(() => {
        fetchApprovals();
    }, [eventFilter]);

    // Local Filtering & Tab Logic
    useEffect(() => {
        if (approvals.length > 0 || !loading) {
            processApprovals();
        }
    }, [approvals, currentTab, searchQuery, user]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [eventsRes] = await Promise.all([
                api.get('/events')
            ]);
            setEvents(eventsRes.events || []);
            // Approvals fetched via fetchApprovals trigger in useEffect
        } catch (err) {
            console.error('Failed to fetch initial data:', err);
            setLoading(false);
        }
    };

    const fetchApprovals = async () => {
        setLoading(true);
        try {
            const query = eventFilter ? `?eventId=${eventFilter}` : '';
            const res = await api.get(`/approvals${query}`);
            setApprovals(res.approvals || []);
        } catch (err) {
            console.error('Failed to fetch approvals:', err);
        } finally {
            setLoading(false);
        }
    };

    const processApprovals = () => {
        let filtered = approvals.filter(item =>
            (item.title || '').toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Tab Filtering
        if (currentTab === 'active') {
            filtered = filtered.filter(item => ['DRAFT', 'PENDING', 'CHANGES_REQUESTED'].includes(item.status));
        } else {
            filtered = filtered.filter(item => ['APPROVED', 'REJECTED'].includes(item.status));
        }

        setDisplayApprovals(filtered);
    };

    const handleApprovalCreated = (newApproval) => {
        setApprovals([newApproval, ...approvals]);
        setShowCreateModal(false);
        // If created, switch to active tab if not already
        if (currentTab !== 'active') setCurrentTab('active');
    };

    const handleApprovalUpdated = (updated) => {
        setApprovals(prev => prev.map(a => a.id === updated.id ? updated : a));
        if (selectedApproval?.id === updated.id) {
            setSelectedApproval(updated);
        }
    };

    const handleApprovalDeleted = (id) => {
        setApprovals(prev => prev.filter(a => a.id !== id));
        setSelectedApproval(null);
    };

    // Full Screen Control Center View
    if (selectedApproval) {
        return (
            <div className={`h-screen flex flex-col ${isDark ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
                <ApprovalDetailView
                    approval={selectedApproval}
                    isDark={isDark}
                    user={user}
                    isDrawer={false}
                    onBack={() => setSelectedApproval(null)}
                    onUpdate={handleApprovalUpdated}
                    onDelete={handleApprovalDeleted}
                />
            </div>
        );
    }

    return (
        <div className={`flex h-screen overflow-hidden ${isDark ? 'bg-[#0A0A0A] text-white' : 'bg-gray-50 text-gray-900'}`}>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Header */}
                <header className={`px-8 py-5 border-b flex items-center justify-between z-10 ${isDark ? 'bg-[#0A0A0A]/95 border-gray-800' : 'bg-white/95 border-gray-200'}`}>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Creative Gallery</h1>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Manage and review creative assets</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Event Dropdown - Fixed Wiring */}
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#151515] border-gray-800' : 'bg-white border-gray-200'}`}>
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <select
                                value={eventFilter}
                                onChange={(e) => setEventFilter(e.target.value)}
                                className={`bg-transparent outline-none cursor-pointer pr-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                            >
                                <option value="">All Events</option>
                                {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                            <ChevronDown className="w-3 h-3 text-gray-500 -ml-1" />
                        </div>

                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-600/20"
                        >
                            <Plus className="w-4 h-4" /> New Project
                        </button>
                    </div>
                </header>

                {/* Toolbar & Tabs */}
                <div className="px-8 flex flex-col gap-4 pt-6 pb-2 border-b border-gray-200/5 dark:border-gray-800/50">

                    {/* Tabs */}
                    <div className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-800">
                        <button
                            onClick={() => setCurrentTab('active')}
                            className={`pb-3 text-sm font-medium transition-colors relative ${currentTab === 'active'
                                    ? (isDark ? 'text-white' : 'text-gray-900')
                                    : 'text-gray-500 hover:text-gray-400'
                                }`}
                        >
                            Active Approvals
                            {currentTab === 'active' && (
                                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full"></span>
                            )}
                        </button>
                        <button
                            onClick={() => setCurrentTab('history')}
                            className={`pb-3 text-sm font-medium transition-colors relative ${currentTab === 'history'
                                    ? (isDark ? 'text-white' : 'text-gray-900')
                                    : 'text-gray-500 hover:text-gray-400'
                                }`}
                        >
                            History
                            {currentTab === 'history' && (
                                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full"></span>
                            )}
                        </button>
                    </div>

                    {/* Filters Row */}
                    <div className="flex items-center justify-between py-2">
                        <div className={`relative w-80`}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none ${isDark ? 'bg-[#151515] border-gray-800 placeholder-gray-600' : 'bg-white border-gray-200'
                                    }`}
                            />
                        </div>

                        {/* View Toggle */}
                        <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-[#151515] border-gray-800' : 'bg-white border-gray-200'}`}>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? (isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900 shadow-sm') : 'text-gray-500 hover:text-gray-400'}`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? (isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900 shadow-sm') : 'text-gray-500 hover:text-gray-400'}`}
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-8 py-8 scrollbar-thin">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {currentTab === 'active' ? 'Active Projects' : 'Project History'}
                        </h2>
                        <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                            {displayApprovals.length} items
                        </span>
                    </div>

                    {loading ? (
                        <div className="py-20 flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                        </div>
                    ) : displayApprovals.length > 0 ? (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {displayApprovals.map(approval => (
                                    <ApprovalGalleryCard
                                        key={approval.id}
                                        approval={approval}
                                        isDark={isDark}
                                        onClick={() => setSelectedApproval(approval)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className={`w-full rounded-xl border overflow-hidden ${isDark ? 'bg-[#111] border-[#333]' : 'bg-white border-gray-200'}`}>
                                <table className="w-full text-left text-sm">
                                    <thead className={`${isDark ? 'bg-[#151515] text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Project</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-4 py-3 font-medium">Event</th>
                                            <th className="px-4 py-3 font-medium">Reviewers</th>
                                            <th className="px-4 py-3 font-medium">Last Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                        {displayApprovals.map(approval => {
                                            const StatusIcon = STATUS_ICONS[approval.status] || Clock;
                                            return (
                                                <tr
                                                    key={approval.id}
                                                    onClick={() => setSelectedApproval(approval)}
                                                    className={`cursor-pointer transition-colors ${isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}
                                                >
                                                    <td className="px-4 py-3 font-medium">
                                                        <div className="flex items-center gap-3">
                                                            {approval.assets?.[0]?.mimeType?.startsWith('image/') ? (
                                                                <img src={approval.assets[0].s3Url} className="w-8 h-8 rounded object-cover bg-gray-700" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                                                                    <Paperclip className="w-4 h-4 text-gray-500" />
                                                                </div>
                                                            )}
                                                            <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{approval.title}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`}>
                                                            <StatusIcon className="w-3 h-3" />
                                                            {approval.status.replace('_', ' ')}
                                                        </div>
                                                    </td>
                                                    <td className={`px-4 py-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        {approval.event?.name || '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex -space-x-1.5">
                                                            {approval.reviewers?.slice(0, 3).map((r, i) => (
                                                                <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] border-2 uppercase ${isDark ? 'bg-[#222] border-[#151515] text-gray-400' : 'bg-gray-100 border-white text-gray-600'}`}>
                                                                    {r.name?.[0] || r.email?.[0]}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className={`px-4 py-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {new Date(approval.updatedAt).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : (
                        <div className="py-20 text-center">
                            <p className="text-gray-500">No projects found in {currentTab === 'active' ? 'active' : 'history'}.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
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

export default ApprovalsDashboard;
