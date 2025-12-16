
import React, { useState } from 'react';
import {
    LayoutDashboard, Calendar, Ticket, BarChart3, Bell, Search, MoreVertical,
    CreditCard, ScanLine, Tags, MapPin, Users, CheckSquare, Sun, Moon, MessageCircle, Wand2, ListTodo
} from 'lucide-react';
import SidebarItem from '../components/SidebarItem';

const DashboardLayout = ({ children, activeView, onNavigate, isDark, toggleTheme }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div
            className={`min-h-screen flex transition-colors duration-300 ${isDark ? 'bg-[#121212] text-gray-100 selection:bg-indigo-500/30' : 'bg-[#f0f2f5] text-gray-900 selection:bg-gray-100'}`}
            style={{ fontFamily: "'Exo', sans-serif" }}
        >
            <style>{`
@import url('https://fonts.googleapis.com/css2?family=Exo:ital,wght@0,100..900;1,100..900&display=swap');
        .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
        .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
        .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.5);
    border-radius: 20px;
}
`}</style>

            {/* Clean Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 ${isDark ? 'bg-[#121212] border-r border-[#1e1e1e]' : 'bg-white border-r border-gray-100'}`}>
                <div className="h-16 flex items-center px-6">
                    <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-indigo-600' : 'bg-gray-800'}`}>
                            <Ticket size={16} className="text-white" />
                        </div>
                        <span className={`text-lg font-semibold tracking-tight ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>TixMo</span>
                    </div>
                </div>

                <div className="p-4 space-y-6 overflow-y-auto h-[calc(100vh-4rem)]">
                    <div className="space-y-1">
                        <p className={`px-4 mb-2 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Platform</p>
                        <SidebarItem
                            icon={LayoutDashboard}
                            label="Overview"
                            active={activeView === 'dashboard'}
                            onClick={() => onNavigate('dashboard')}
                            isDark={isDark}
                        />
                        <SidebarItem
                            icon={Calendar}
                            label="Events"
                            active={activeView === 'events'}
                            onClick={() => onNavigate('events')}
                            isDark={isDark}
                        />
                        <SidebarItem
                            icon={CreditCard}
                            label="Orders"
                            active={activeView === 'orders'}
                            onClick={() => onNavigate('orders')}
                            isDark={isDark}
                        />
                        <SidebarItem
                            icon={CheckSquare}
                            label="Team Tasks"
                            active={activeView === 'todo'}
                            onClick={() => onNavigate('todo')}
                            isDark={isDark}
                        />
                        <SidebarItem
                            icon={ListTodo}
                            label="My TODO's"
                            active={activeView === 'personal-todo'}
                            onClick={() => onNavigate('personal-todo')}
                            isDark={isDark}
                        />
                        <SidebarItem
                            icon={Users}
                            label="Team"
                            active={activeView === 'team'}
                            onClick={() => onNavigate('team')}
                            isDark={isDark}
                        />
                        <SidebarItem
                            icon={MessageCircle}
                            label="Social"
                            active={activeView === 'social'}
                            onClick={() => onNavigate('social')}
                            isDark={isDark}
                        />
                    </div>

                    <div className="space-y-1">
                        <p className={`px-4 mb-2 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Tools</p>
                        <SidebarItem
                            icon={ScanLine}
                            label="Scanners"
                            active={activeView === 'scanners'}
                            onClick={() => onNavigate('scanners')}
                            isDark={isDark}
                        />
                        <SidebarItem
                            icon={Tags}
                            label="Promotions"
                            active={activeView === 'promo'}
                            onClick={() => onNavigate('promo')}
                            isDark={isDark}
                        />
                        <SidebarItem
                            icon={MapPin}
                            label="Venues"
                            active={activeView === 'venues'}
                            onClick={() => onNavigate('venues')}
                            isDark={isDark}
                        />
                        <SidebarItem
                            icon={Wand2}
                            label="Creative Composer"
                            active={activeView === 'creative'}
                            onClick={() => onNavigate('creative')}
                            isDark={isDark}
                        />
                    </div>

                    <div className="space-y-1">
                        <p className={`px-4 mb-2 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Data</p>
                        <SidebarItem
                            icon={BarChart3}
                            label="Analytics"
                            active={activeView === 'analytics'}
                            onClick={() => onNavigate('analytics')}
                            isDark={isDark}
                        />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Minimalist Header */}
                <header className={`h-16 flex items-center justify-between px-6 sticky top-0 z-40 transition-colors ${isDark ? 'bg-[#121212]/90 backdrop-blur-md' : 'bg-[#f0f2f5]/90 backdrop-blur-md'}`}>
                    <div className="flex items-center lg:hidden">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`p-2 rounded-lg ${isDark ? 'text-gray-400 hover:bg-[#1e1e1e]' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <MoreVertical size={24} className="rotate-90" />
                        </button>
                    </div>

                    {/* Search - Subtle */}
                    <div className="hidden lg:flex items-center flex-1 max-w-md">
                        <div className="relative w-full group">
                            <Search size={16} className={`absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors ${isDark ? 'text-gray-600 group-focus-within:text-gray-400' : 'text-gray-400 group-focus-within:text-gray-600'}`} />
                            <input
                                type="text"
                                placeholder="Search..."
                                className={`w-full bg-transparent border-none focus:ring-0 text-sm pl-10 py-2 ${isDark ? 'text-gray-300 placeholder-gray-700' : 'text-gray-700 placeholder-gray-400'}`}
                            />
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={toggleTheme}
                            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-500 hover:text-gray-200 hover:bg-[#1e1e1e]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <button className={`relative transition-colors ${isDark ? 'text-gray-500 hover:text-gray-200' : 'text-gray-400 hover:text-gray-900'}`}>
                            <Bell size={18} />
                            <span className={`absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border-2 ${isDark ? 'border-[#121212]' : 'border-[#f0f2f5]'}`}></span>
                        </button>

                        <div className="flex items-center space-x-3 cursor-pointer">
                            <div className={`w-8 h-8 rounded-full overflow-hidden ${isDark ? 'bg-[#1e1e1e]' : 'bg-gray-200'}`}>
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="Profile" />
                            </div>
                            <span className={`text-sm font-medium hidden md:block ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Sarah J.</span>
                        </div>
                    </div>
                </header>

                {/* Main Scrollable Area */}
                <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    {children}
                </main>

            </div>
        </div>
    );
};

export default DashboardLayout;
