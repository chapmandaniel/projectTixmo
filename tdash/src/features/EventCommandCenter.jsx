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
        <div className={`flex h-[calc(100vh-80px)] overflow-hidden rounded-2xl shadow-2xl border ${isDark ? 'bg-[#121212] border-[#333]' : 'bg-white border-gray-200'}`}>

            {/* Sidebar */}
            <aside className={`flex flex-col transition-all duration-300 border-r ${isDark ? 'border-[#333] bg-[#1a1a1a]' : 'border-gray-200 bg-gray-50'} ${isSidebarOpen ? 'w-64' : 'w-20'}`}>

                {/* Event Context Header in Sidebar */}
                <div className="p-4 border-b border-gray-200/10 h-20 flex items-center">
                    {isSidebarOpen ? (
                        <div className="flex flex-col overflow-hidden">
                            <h2 className={`font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.name}</h2>
                            <span className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {event.startDateTime ? new Date(event.startDateTime).toLocaleDateString() : 'Date TBA'}
                            </span>
                        </div>
                    ) : (
                        <div className="w-full flex justify-center">
                            <Calendar size={24} className="text-indigo-500" />
                        </div>
                    )}
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveView(item.id)}
                                className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors group relative
                                    ${isActive
                                        ? (isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600')
                                        : (isDark ? 'text-gray-400 hover:bg-[#252525] hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
                                    }
                                `}
                                title={!isSidebarOpen ? item.label : ''}
                            >
                                <Icon size={20} className={`${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                                {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                                {isActive && isSidebarOpen && (
                                    <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-gray-200/10 space-y-2">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`w-full flex items-center justify-center p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#252525] text-gray-500' : 'hover:bg-gray-200 text-gray-400'}`}
                    >
                        {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
                    </button>
                    <button
                        onClick={onBack}
                        className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors text-rose-500 ${isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'}`}
                    >
                        <LogOut size={20} className={`${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                        {isSidebarOpen && <span className="font-medium text-sm">Exit Dashboard</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden relative">

                {/* Top Header */}
                <header className={`h-16 border-b flex items-center justify-between px-6 ${isDark ? 'bg-[#121212] border-[#333]' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center space-x-4">
                        <StatusBadge status={event.status} isDark={isDark} />
                        <span className={`text-sm flex items-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <MapPin size={14} className="mr-1" />
                            {event.venue?.name || 'Venue TBA'}
                        </span>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#252525] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <Bell size={20} />
                        </button>
                        <div className="h-6 w-px bg-gray-700/50 mx-2"></div>
                        <button className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm border transition-colors ${isDark ? 'border-[#333] text-gray-300 hover:bg-[#252525]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}>
                            <Globe size={14} />
                            <span>View Public Page</span>
                        </button>
                    </div>
                </header>

                {/* View Content */}
                <div className={`flex-1 overflow-y-auto p-8 relative ${isDark ? 'bg-[#121212]' : 'bg-gray-50'}`}>
                    {renderContent()}
                </div>

            </main>

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
