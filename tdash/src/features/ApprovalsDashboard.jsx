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
    Paperclip,
    FolderGit2,
    Settings,
    MoreVertical
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ApprovalGalleryCard from './ApprovalGalleryCard';
import ApprovalStudio from './ApprovalStudio';
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
    const [statusFilter, setStatusFilter] = useState('PENDING'); // Default to PENDING
    const [viewMode, setViewMode] = useState('grid');
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, MEDIA, SOCIAL
    const [events, setEvents] = useState([]);
    const [showStudio, setShowStudio] = useState(false);
    const [selectedApproval, setSelectedApproval] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
    }, [approvals, statusFilter, typeFilter, searchQuery, user]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [eventsRes] = await Promise.all([
                api.get('/events')
            ]);
            setEvents(eventsRes.data?.events || eventsRes.events || []);
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

        // Status Filtering
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(item => item.status === statusFilter);
        }

        // Type Filtering
        if (typeFilter !== 'ALL') {
            filtered = filtered.filter(item => item.type === typeFilter);
        }

        setDisplayApprovals(filtered);
    };

    const handleApprovalCreated = (newApproval) => {
        setApprovals([newApproval, ...approvals]);
        // Switch to the status of the new item (usually DRAFT)
        setStatusFilter('DRAFT');
    };

    const handleStudioSuccess = () => {
        fetchApprovals(); // Refresh list to get new item
        setShowStudio(false);
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
            <div className={`h-screen flex flex-col ${isDark ? 'bg-[#151521]' : 'bg-gray-50'}`}>
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
        <div className={`flex flex-col w-full h-[calc(100vh-64px)] overflow-hidden -m-6 sm:-m-8 px-4 sm:px-6 pt-6 pb-0 ${isDark ? 'bg-[#151521]' : 'bg-gray-50'}`}>

            {/* Unified Top Header Bar/Card */}
            <div className="mb-6 shrink-0 relative z-10 w-full">
                <div className={`flex items-center justify-between px-4 sm:px-5 py-3 rounded-md shadow-sm w-full ${isDark ? 'bg-[#1e1e2d] border border-[#2b2b40]/60' : 'bg-white border border-gray-200/60'}`}>

                    {/* Left Title */}
                    <div className="flex flex-1 items-center space-x-4 overflow-hidden mr-4">
                        <div className={`p-2 rounded-md shrink-0 transition-colors ${isDark ? 'bg-[#232336] text-[#a1a5b7]' : 'bg-indigo-50 text-indigo-500'} shadow-sm`}>
                            <FolderGit2 size={20} />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <h2 className={`text-xl sm:text-2xl tracking-tight truncate font-normal ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                Client Approvals
                            </h2>
                            <div className={`flex items-center space-x-3 text-[11px] sm:text-xs tracking-wide mt-1 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'} overflow-hidden`}>
                                <span className="truncate">Manage and review creative assets</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Event Dropdown */}
                        <div className={`relative flex items-center gap-2 px-3 py-2 rounded-md border text-sm w-48 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200'}`}>
                            <Calendar className="w-4 h-4 text-gray-500 pointer-events-none absolute left-3" />
                            <select
                                value={eventFilter}
                                onChange={(e) => setEventFilter(e.target.value)}
                                className={`w-full h-full bg-transparent outline-none cursor-pointer appearance-none pl-6 pr-6 font-light ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                            >
                                <option value="">All Events</option>
                                {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 w-3 h-3 text-gray-500 pointer-events-none" />
                        </div>

                        <button
                            onClick={() => setShowStudio(true)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-lg ${isDark ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'}`}
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">New Project</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Split View (Sidebar + Main Content) */}
            <div className="flex flex-1 overflow-hidden">

                {/* Sidebar Setup */}
                <aside className={`flex flex-col transition-all duration-300 shrink-0 ${isSidebarOpen ? 'w-56' : 'w-20'}`}>
                    <nav className="flex-1 overflow-y-auto py-2 pr-4 space-y-1">
                        {[
                            { id: 'ALL', label: 'All Projects', icon: LayoutGrid },
                            { id: 'PENDING', label: 'Pending Review', icon: Eye },
                            { id: 'DRAFT', label: 'Drafts', icon: Clock },
                            { id: 'CHANGES_REQUESTED', label: 'In Revision', icon: Edit3 },
                            { id: 'APPROVED', label: 'Approved', icon: CheckCircle },
                            { id: 'REJECTED', label: 'Rejected', icon: XCircle },
                        ].map(filter => {
                            const Icon = filter.icon;
                            const isActive = statusFilter === filter.id;
                            return (
                                <button
                                    key={filter.id}
                                    onClick={() => setStatusFilter(filter.id)}
                                    className={`w-full flex items-center px-4 py-2.5 rounded-r-md transition-colors group relative
                                        ${isActive
                                            ? (isDark ? 'bg-[#2b2b40] text-gray-100 shadow-sm' : 'bg-indigo-50 text-indigo-600')
                                            : (isDark ? 'text-[#a1a5b7] hover:bg-[#232336] hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
                                        }
                                    `}
                                    title={!isSidebarOpen ? filter.label : ''}
                                >
                                    <Icon size={18} className={`${isSidebarOpen ? 'mr-3' : 'mx-auto'} ${isActive && isDark ? 'text-pink-500' : ''}`} />
                                    {isSidebarOpen && <span className="font-light tracking-wide text-sm whitespace-nowrap">{filter.label}</span>}
                                    {isActive && isSidebarOpen && (
                                        <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-r-md bg-gradient-to-b from-pink-500 to-orange-400"></div>
                                    )}
                                    {isActive && !isSidebarOpen && (
                                        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-md bg-gradient-to-b from-pink-500 to-orange-400"></div>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="p-4 mt-auto border-t border-gray-200/50 dark:border-[#2b2b40]/50 pr-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className={`flex items-center w-full p-2 rounded-md transition-colors ${isDark ? 'text-[#a1a5b7] hover:bg-[#232336] hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
                        >
                            <Settings size={18} className={`${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                            {isSidebarOpen && <span className="font-light tracking-wide text-sm whitespace-nowrap">Settings</span>}
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pl-2 lg:pl-6">
                    {/* Search & Toolbar */}

                    {/* Type Filters */}
                    <div className="flex items-center gap-2 pb-2">
                        {['ALL', 'MEDIA', 'SOCIAL'].map(type => (
                            <button
                                key={type}
                                onClick={() => setTypeFilter(type)}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${typeFilter === type
                                    ? isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
                                    : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {type === 'ALL' ? 'All Types' : type === 'MEDIA' ? 'Media Assets' : 'Social Posts'}
                            </button>
                        ))}
                    </div>

                    {/* Search & View Toggle Row */}
                    <div className="flex items-center justify-between py-2">
                        <div className={`relative w-80`}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by title..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full pl-10 pr-4 py-2 rounded-md border text-sm focus:ring-2 focus:ring-pink-500/50 outline-none font-light ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] placeholder-gray-500 text-gray-200' : 'bg-white border-gray-200'
                                    }`}
                            />
                        </div>

                        {/* View Toggle */}
                        <div className={`flex items-center p-1 rounded-md border ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200'}`}>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? (isDark ? 'bg-[#2b2b40] text-gray-100' : 'bg-gray-100 text-gray-900 shadow-sm') : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? (isDark ? 'bg-[#2b2b40] text-gray-100' : 'bg-gray-100 text-gray-900 shadow-sm') : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Content grids moved right up here */}
                    <div className="mt-6 mb-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {statusFilter === 'ALL' ? 'All Approvals' : statusFilter.replace('_', ' ')}
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
                                <div className={`w-full rounded-md border overflow-hidden ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200'}`}>
                                    <table className="w-full text-left text-sm font-light">
                                        <thead className={`${isDark ? 'bg-[#2b2b40] text-[#a1a5b7]' : 'bg-gray-50 text-gray-500'}`}>
                                            <tr>
                                                <th className="px-6 py-4 font-light tracking-wide">Project</th>
                                                <th className="px-6 py-4 font-light tracking-wide">Status</th>
                                                <th className="px-6 py-4 font-light tracking-wide">Event</th>
                                                <th className="px-6 py-4 font-light tracking-wide">Reviewers</th>
                                                <th className="px-6 py-4 font-light tracking-wide">Last Updated</th>
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
                                                                    <img
                                                                        src={approval.assets[0].s3Url}
                                                                        className="w-8 h-8 rounded object-cover bg-gray-700"
                                                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/e2e8f0/94a3b8?text=Img'; }}
                                                                    />
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
                            <div className="py-20 text-center flex flex-col items-center">
                                <Search className={`w-8 h-8 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                    No projects found for '{statusFilter === 'ALL' ? 'All Projects' : statusFilter.replace('_', ' ')}'.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Studio Modal */}
            {showStudio && (
                <ApprovalStudio
                    isDark={isDark}
                    user={user}
                    onClose={() => setShowStudio(false)}
                    onSuccess={handleStudioSuccess}
                    initialData={{ eventId: eventFilter }}
                />
            )}
        </div>
    );
};

export default ApprovalsDashboard;
