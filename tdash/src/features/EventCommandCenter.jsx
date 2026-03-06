import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard, Ticket, Users, Settings, ChevronLeft, Menu, LogOut,
    Calendar, MapPin, Globe, CreditCard, Megaphone, Bell
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import ECC_Overview from './ECC_Overview';
import ECC_Orders from './ECC_Orders';
import ECC_Attendees from './ECC_Attendees';
import ECC_Tickets from './ECC_Tickets';
import ECC_Marketing from './ECC_Marketing';
import ECC_Settings from './ECC_Settings';
import EventStudio from './EventStudio';

/**
 * Event Command Center (ECC)
 * The new main dashboard for managing a single event.
 * Features a persistent sidebar and deep-dive sub-views.
 */
const EventCommandCenter = ({ event, onBack, isDark, user, onUpdate }) => {
    const [activeView, setActiveView] = useState('overview');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);

    // Navigation Items
    const navItems = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'orders', label: 'Orders', icon: CreditCard },
        { id: 'attendees', label: 'Attendees', icon: Users },
        { id: 'tickets', label: 'Tickets', icon: Ticket },
        { id: 'marketing', label: 'Marketing', icon: Megaphone },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    const handleEditSuccess = () => {
        // Trigger a refresh/update if needed
        if (onUpdate) {
            // In a real app we might fetch the fresh event here or rely on the parent wrapper to reload
            // For now, let's assume the parent handles data reload or we just close for now.
            onUpdate(); // Signal parent to refresh
        }
    };

    // Render the active view component
    const renderContent = () => {
        switch (activeView) {
            case 'overview':
                return <ECC_Overview event={event} isDark={isDark} />;
            case 'orders':
                return <ECC_Orders event={event} isDark={isDark} />;
            case 'attendees':
                return <ECC_Attendees event={event} isDark={isDark} />;
            case 'tickets':
                return <ECC_Tickets event={event} isDark={isDark} />;
            case 'marketing':
                return <ECC_Marketing event={event} isDark={isDark} />;
            case 'settings':
                return <ECC_Settings event={event} isDark={isDark} onEdit={() => setShowEditModal(true)} />;
            default:
                return <ECC_Overview event={event} isDark={isDark} />;
        }
    };

    return (
        <div className={`flex flex-col w-full h-[calc(100vh-64px)] overflow-hidden -m-6 sm:-m-8 px-4 sm:px-6 pt-6 pb-0 ${isDark ? 'bg-[#151521]' : 'bg-gray-50'}`}>

            {/* Unified Top Header Bar/Card */}
            <div className="mb-6 shrink-0 relative z-10 w-full">
                <div className={`flex items-center justify-between px-4 sm:px-5 py-3 rounded-md shadow-sm w-full ${isDark ? 'bg-[#1e1e2d] border border-[#2b2b40]/60' : 'bg-white border border-gray-200/60'}`}>
                    {/* Left Side: Event Identity */}
                    <div className="flex flex-1 items-center space-x-4 overflow-hidden mr-4">
                        <button
                            onClick={onBack}
                            className={`p-2 rounded-md shrink-0 transition-colors ${isDark ? 'bg-[#1e1e2d] text-[#a1a5b7] hover:text-white hover:bg-[#232336]' : 'bg-white border border-gray-200/60 text-gray-500 hover:text-gray-900'} shadow-sm`}
                            title="Back to Dashboard"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div className="flex flex-col overflow-hidden">
                            <h2 className={`text-xl sm:text-2xl tracking-tight truncate font-normal ${isDark ? 'text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-orange-400' : 'text-indigo-600'}`}>
                                {event.name}
                            </h2>
                            <div className={`flex items-center space-x-3 text-[11px] sm:text-xs tracking-wide uppercase mt-1 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'} overflow-hidden`}>
                                <span className="flex items-center whitespace-nowrap shrink-0">
                                    <Calendar size={12} className="mr-1.5 opacity-70" />
                                    {event.startDateTime ? new Date(event.startDateTime).toLocaleDateString() : 'Date TBA'}
                                </span>
                                <span className="opacity-40 shrink-0">•</span>
                                <span className="flex items-center truncate">
                                    <MapPin size={12} className="mr-1.5 opacity-70 shrink-0" />
                                    <span className="truncate">{event.venue?.name || 'Venue TBA'}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Status & Actions */}
                    <div className="flex items-center space-x-4 shrink-0">
                        <div className="hidden sm:block">
                            <StatusBadge status={event.status} isDark={isDark} />
                        </div>
                        <div className={`hidden sm:block h-6 w-[1px] ${isDark ? 'bg-[#2b2b40]' : 'bg-gray-200'}`}></div>

                        <button className={`p-2 rounded-md transition-colors ${isDark ? 'hover:bg-[#232336] text-[#a1a5b7]' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <Bell size={20} />
                        </button>

                        <button className={`hidden md:flex items-center space-x-2 px-4 py-2 rounded-md text-sm border font-light tracking-wide transition-colors ${isDark ? 'border-[#2b2b40]/60 text-gray-300 hover:bg-[#232336]' : 'border-gray-200/60 text-gray-600 hover:bg-gray-50'}`}>
                            <Globe size={14} />
                            <span>Public Page</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Split View (Sidebar + Main Content) */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className={`flex flex-col transition-all duration-300 shrink-0 ${isSidebarOpen ? 'w-56' : 'w-20'}`}>

                    {/* Navigation Links */}
                    <nav className="flex-1 overflow-y-auto py-2 pr-4 space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeView === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveView(item.id)}
                                    className={`w-full flex items-center px-4 py-2.5 rounded-r-md transition-colors group relative
                                        ${isActive
                                            ? (isDark ? 'bg-[#2b2b40] text-gray-100 shadow-sm' : 'bg-indigo-50 text-indigo-600')
                                            : (isDark ? 'text-[#a1a5b7] hover:bg-[#232336] hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
                                        }
                                    `}
                                    title={!isSidebarOpen ? item.label : ''}
                                >
                                    <Icon size={18} className={`${isSidebarOpen ? 'mr-3' : 'mx-auto'} ${isActive && isDark ? 'text-pink-500' : ''}`} />
                                    {isSidebarOpen && <span className="font-light tracking-wide text-sm">{item.label}</span>}
                                    {isActive && isSidebarOpen && (
                                        <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-r-md bg-gradient-to-b from-pink-500 to-orange-400"></div>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="p-4 space-y-2 border-t border-gray-200/5">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className={`w-full flex items-center justify-center p-2 rounded-md transition-colors ${isDark ? 'hover:bg-[#232336] text-[#a1a5b7]' : 'hover:bg-gray-200 text-gray-400'}`}
                            title={isSidebarOpen ? "Collapse Menu" : "Expand Menu"}
                        >
                            {isSidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
                        </button>
                        <button
                            onClick={onBack}
                            className={`w-full flex items-center px-3 py-2 rounded-md transition-colors text-rose-500 ${isDark ? 'hover:bg-[#232336]' : 'hover:bg-rose-50'}`}
                            title={!isSidebarOpen ? "Exit Dashboard" : ""}
                        >
                            <LogOut size={18} className={`${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                            {isSidebarOpen && <span className="font-light tracking-wide text-sm">Exit</span>}
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    {/* View Content */}
                    <div className="flex-1 overflow-y-auto pb-6 relative">
                        {renderContent()}
                    </div>
                </main>
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <EventStudio
                    isDark={isDark}
                    initialData={event}
                    user={user}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={handleEditSuccess}
                />
            )}
        </div>
    );
};

export default EventCommandCenter;
