import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard, Ticket, Users, Settings, ChevronLeft, Menu, LogOut,
    Calendar, MapPin, Globe, CreditCard, Megaphone, Bell, Copy, ExternalLink
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generateEventSlug } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';
import { DashboardButton, DashboardIconButton } from '../components/dashboard/DashboardPrimitives';
import ECC_Overview from './ECC_Overview';
import ECC_Orders from './ECC_Orders';
import ECC_Attendees from './ECC_Attendees';
import ECC_Tickets from './ECC_Tickets';
import ECC_Settings from './ECC_Settings';
import EventStudio from './EventStudio';
import DashboardPlaceholderView from './DashboardPlaceholderView';

/**
 * Event Command Center (ECC)
 * The new main dashboard for managing a single event.
 * Features a persistent sidebar and deep-dive sub-views.
 */
const EventCommandCenter = ({ event, onBack, isDark, user, onUpdate }) => {
    const location = useLocation();
    const navigate = useNavigate();

    // Extract the active sub-view from the URL (e.g., /events/:id/attendees)
    const pathParts = location.pathname.split('/');
    const activeView = pathParts[3] || 'overview';

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [checkoutCopyStatus, setCheckoutCopyStatus] = useState('');
    const eventName = event.name || event.title || 'Event';
    const checkoutSlug = event.slug || generateEventSlug(eventName, event.id);
    const checkoutUrl = `${window.location.origin}/checkout/${checkoutSlug}`;
    const publicCheckoutStatuses = new Set(['PUBLISHED', 'ON_SALE', 'SOLD_OUT']);
    const canUseCheckoutLink = publicCheckoutStatuses.has(event.status);

    // Navigation Items
    const navItems = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'orders', label: 'Orders', icon: CreditCard },
        { id: 'attendees', label: 'Attendees', icon: Users },
        { id: 'tickets', label: 'Tickets', icon: Ticket },
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

    const handleCopyCheckoutLink = async () => {
        if (!canUseCheckoutLink) {
            return;
        }

        try {
            await navigator.clipboard.writeText(checkoutUrl);
            setCheckoutCopyStatus('Checkout link copied');
        } catch {
            setCheckoutCopyStatus('Copy failed');
        }
    };

    const handleOpenCheckoutLink = () => {
        if (!canUseCheckoutLink) {
            return;
        }

        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
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
                return (
                    <DashboardPlaceholderView
                        isDark={isDark}
                        title="Marketing"
                        icon={Megaphone}
                        description="This event module is outside the V1 beta scope and is hidden from the event command center until the launch path is stable."
                        badgeLabel="Outside V1 beta"
                    />
                );
            case 'settings':
                return <ECC_Settings event={event} isDark={isDark} onEdit={() => setShowEditModal(true)} />;
            default:
                return <ECC_Overview event={event} isDark={isDark} />;
        }
    };

    return (
        <div className={`flex min-h-[calc(100vh-72px)] w-full flex-col overflow-visible -m-4 px-4 pb-6 pt-4 sm:-m-6 sm:px-6 sm:pt-6 lg:-m-8 lg:h-[calc(100vh-72px)] lg:overflow-hidden lg:px-6 lg:pb-0 ${isDark ? 'bg-dashboard-shell' : 'bg-gray-50'}`}>

            {/* Unified Top Header Bar/Card */}
            <div className="relative z-10 mb-4 w-full shrink-0 sm:mb-6">
                <div className={`flex w-full flex-col gap-4 rounded-md px-4 py-3 shadow-sm sm:px-5 lg:flex-row lg:items-center lg:justify-between ${isDark ? 'border border-dashboard-border bg-dashboard-panel' : 'bg-white border border-gray-200/60'}`}>
                    {/* Left Side: Event Identity */}
                    <div className="flex min-w-0 flex-1 items-center space-x-3 overflow-hidden sm:space-x-4 lg:mr-4">
                        <button
                            onClick={onBack}
                            className={`p-2 rounded-md shrink-0 transition-colors ${isDark ? 'bg-[#1e1e2d] text-[#a1a5b7] hover:text-white hover:bg-[#232336]' : 'bg-white border border-gray-200/60 text-gray-500 hover:text-gray-900'} shadow-sm`}
                            title="Back to Dashboard"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div className="flex min-w-0 flex-col overflow-hidden">
                            <h2 className={`text-xl sm:text-2xl tracking-tight truncate font-normal ${isDark ? 'text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-orange-400' : 'text-indigo-600'}`}>
                                {eventName}
                            </h2>
                            <div className={`mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-wide sm:text-xs ${isDark ? 'text-dashboard-muted' : 'text-gray-500'}`}>
                                <span className="flex items-center whitespace-nowrap shrink-0">
                                    <Calendar size={12} className="mr-1.5 opacity-70" />
                                    {event.startDateTime ? new Date(event.startDateTime).toLocaleDateString() : 'Date TBA'}
                                </span>
                                <span className="hidden opacity-40 sm:inline">•</span>
                                <span className="flex min-w-0 items-center truncate">
                                    <MapPin size={12} className="mr-1.5 opacity-70 shrink-0" />
                                    <span className="truncate">{event.venue?.name || 'Venue TBA'}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Status & Actions */}
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 sm:justify-end">
                        <div className="block">
                            <StatusBadge status={event.status} isDark={isDark} />
                        </div>
                        <div className={`hidden h-6 w-[1px] sm:block ${isDark ? 'bg-dashboard-border' : 'bg-gray-200'}`}></div>

                        <button className={`p-2 rounded-md transition-colors ${isDark ? 'hover:bg-dashboard-panelAlt text-dashboard-muted' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <Bell size={20} />
                        </button>

                        <div className="flex items-center gap-2">
                            <DashboardIconButton
                                isDark={isDark}
                                aria-label="Copy checkout link"
                                title={canUseCheckoutLink ? 'Copy checkout link' : 'Checkout link available after publish'}
                                disabled={!canUseCheckoutLink}
                                onClick={handleCopyCheckoutLink}
                                className="disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Copy size={17} />
                            </DashboardIconButton>
                            <DashboardButton
                                isDark={isDark}
                                variant="secondary"
                                onClick={handleOpenCheckoutLink}
                                disabled={!canUseCheckoutLink}
                                className="hidden h-10 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40 md:inline-flex"
                                title={canUseCheckoutLink ? checkoutUrl : 'Checkout link available after publish'}
                            >
                                <Globe size={14} />
                                Checkout
                                <ExternalLink size={13} />
                            </DashboardButton>
                        </div>
                        {checkoutCopyStatus ? (
                            <span className={`basis-full text-right text-[11px] font-light ${checkoutCopyStatus === 'Copy failed' ? 'text-rose-300' : 'text-emerald-300'}`}>
                                {checkoutCopyStatus}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Split View (Sidebar + Main Content) */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-visible lg:flex-row lg:gap-0 lg:overflow-hidden">
                {/* Sidebar */}
                <aside className={`flex shrink-0 flex-col transition-all duration-300 lg:${isSidebarOpen ? 'w-56' : 'w-20'}`}>

                    {/* Navigation Links */}
                    <nav className="hide-scrollbar flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:flex-col lg:space-y-1 lg:overflow-y-auto lg:py-2 lg:pr-4">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeView === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => navigate(`/events/${generateEventSlug(event.name, event.id)}/${item.id}`, { replace: true, state: location.state })}
                                    className={`group relative flex min-w-max items-center rounded-md px-4 py-2.5 transition-colors lg:w-full lg:rounded-r-md
                                        ${isActive
                                            ? (isDark ? 'bg-[#2b2b40] text-gray-100 shadow-sm' : 'bg-indigo-50 text-indigo-600')
                                            : (isDark ? 'text-[#a1a5b7] hover:bg-[#232336] hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
                                        }
                                    `}
                                    title={!isSidebarOpen ? item.label : ''}
                                >
                                    <Icon size={18} className={`${isSidebarOpen ? 'mr-3' : 'lg:mx-auto'} ${isActive && isDark ? 'text-pink-500' : ''}`} />
                                    <span className={`${isSidebarOpen ? 'inline' : 'lg:hidden'} text-sm font-light tracking-wide`}>{item.label}</span>
                                    {isActive && (
                                        <div className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-md bg-gradient-to-r from-pink-500 to-orange-400 lg:inset-x-auto lg:bottom-0 lg:left-0 lg:top-0 lg:h-auto lg:w-[4px] lg:rounded-r-md lg:bg-gradient-to-b"></div>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="hidden space-y-2 border-t border-gray-200/5 p-4 lg:block">
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
                <main className="relative flex min-h-0 flex-1 flex-col overflow-visible lg:overflow-hidden">
                    {/* View Content */}
                    <div className="relative flex-1 overflow-visible pb-6 lg:overflow-y-auto">
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
