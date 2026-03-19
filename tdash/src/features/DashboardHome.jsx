import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Calendar, CheckSquare, BarChart3,
    CreditCard, ScanLine, Tags, MapPin, Users,
    MessageCircle, Wand2, ListTodo, Settings, CheckCircle, Heart, Eye, EyeOff, BrainCircuit
} from 'lucide-react';
import api from '../lib/api';

const gridItems = [
    { id: 'events', icon: Calendar, label: 'Events Hub', description: 'Manage and create your upcoming events.', grad: 'from-pink-500 to-orange-400', color: 'text-pink-500' },
    { id: 'orders', icon: CreditCard, label: 'Orders & Sales', description: 'Track tickets sold and revenue.', grad: 'from-cyan-400 to-blue-500', color: 'text-cyan-400' },
    { id: 'todo', icon: CheckSquare, label: 'Team Tasks', description: 'Collaborate and assign work.', grad: 'from-indigo-400 to-purple-500', color: 'text-indigo-400' },
    { id: 'personal-todo', icon: ListTodo, label: "My TODO's", description: 'Your personal checklist.', grad: 'from-emerald-400 to-teal-500', color: 'text-emerald-400' },
    { id: 'team', icon: Users, label: 'Team Members', description: 'Manage organization access.', grad: 'from-rose-400 to-red-500', color: 'text-rose-400' },
    { id: 'social', icon: MessageCircle, label: 'Social & CRM', description: 'Connect with your audience.', grad: 'from-fuchsia-500 to-purple-600', color: 'text-fuchsia-500' },
    { id: 'scanners', icon: ScanLine, label: 'Scanners', description: 'Setup on-site ticket scanning.', grad: 'from-yellow-400 to-orange-500', color: 'text-yellow-400' },
    { id: 'promo', icon: Tags, label: 'Promotions', description: 'Create discount codes.', grad: 'from-teal-400 to-emerald-500', color: 'text-teal-400' },
    { id: 'venues', icon: MapPin, label: 'Venues', description: 'Manage your locations.', grad: 'from-red-400 to-pink-500', color: 'text-red-400' },
    { id: 'creative', icon: Wand2, label: 'Creative Studio', description: 'Design event assets.', grad: 'from-purple-500 to-indigo-500', color: 'text-purple-500' },
    { id: 'approvals', icon: CheckCircle, label: 'Approvals', description: 'Review pending requests.', grad: 'from-lime-400 to-emerald-500', color: 'text-lime-400' },
    { id: 'quantmo', icon: BrainCircuit, label: 'QuantMo', description: 'AI-driven quant intelligence for promoters.', grad: 'from-fuchsia-500 to-cyan-400', color: 'text-fuchsia-400' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics', description: 'Deep dive into your metrics.', grad: 'from-blue-400 to-indigo-600', color: 'text-blue-400' },
    { id: 'settings', icon: Settings, label: 'Settings', description: 'Configure application preferences.', grad: 'from-gray-500 to-slate-600', color: 'text-gray-400' },
];

const DashboardHome = ({ isDark, user, onNavigate }) => {
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const [favorites, setFavorites] = useState(() => {
        try {
            const saved = localStorage.getItem('tixmo_dashboard_favorites');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const [hiddenCards, setHiddenCards] = useState(() => {
        try {
            const saved = localStorage.getItem('tixmo_dashboard_hidden');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const toggleFavorite = (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        setFavorites(prev => {
            const newFavs = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
            localStorage.setItem('tixmo_dashboard_favorites', JSON.stringify(newFavs));
            return newFavs;
        });
    };

    const toggleHidden = (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        setHiddenCards(prev => {
            const newHidden = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
            localStorage.setItem('tixmo_dashboard_hidden', JSON.stringify(newHidden));
            return newHidden;
        });
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const approvalRes = await api.get('/approvals?status=PENDING_REVIEW').catch(() => null);
                if (approvalRes) {
                    const approvals = approvalRes.approvals || approvalRes.data?.approvals || [];
                    setPendingApprovalsCount(approvals.length);
                }
            } catch (error) {
                console.error('Failed to fetch dashboard data', error);
            }
        };

        if (user) {
            fetchDashboardData();
        }
    }, [user]);

    const sortedItems = [...gridItems].sort((a, b) => {
        const aFav = favorites.includes(a.id);
        const bFav = favorites.includes(b.id);
        const aHidden = hiddenCards.includes(a.id);
        const bHidden = hiddenCards.includes(b.id);

        // Hidden items filter to bottom
        if (aHidden && !bHidden) return 1;
        if (!aHidden && bHidden) return -1;

        // Favorites filtering
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;

        return 0; // maintain original relative order
    });

    return (
        <div className="space-y-8 animate-fade-in max-w-[1600px] mx-auto pb-12">

            <div className="flex flex-col space-y-1.5 mb-8">
                <h2 className={`text-3xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    Welcome back, {user?.firstName || 'User'}
                </h2>
                <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-base font-light`}>
                    Access all your modules and tools from your control center.
                </p>
            </div>

            {/* Expansive Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sortedItems.map((item) => {
                    const badge = item.id === 'approvals' && pendingApprovalsCount > 0 ? pendingApprovalsCount : null;
                    const isFav = favorites.includes(item.id);
                    const isHidden = hiddenCards.includes(item.id);

                    return (
                        <Link
                            key={item.id}
                            to={`/${item.id}`}
                            className={`relative text-left flex flex-col p-6 rounded-md border transition-all duration-300 group overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 
                                ${isHidden
                                    ? (isDark
                                        ? `bg-[#151521] border-[#2b2b40]/30 opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0 focus:opacity-100 focus:grayscale-0`
                                        : `bg-gray-50 border-gray-200/50 opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0 focus:opacity-100 focus:grayscale-0`)
                                    : (isDark
                                        ? `bg-[#1e1e2d] border-[#2b2b40] hover:bg-[#232336] hover:border-[#3a3a5a] hover:shadow-2xl hover:shadow-black/50`
                                        : `bg-white border-gray-200 hover:bg-gray-50 hover:shadow-xl shadow-sm`)
                                }`}
                        >
                            {/* Colorful Gradient Top Bar for Square Aesthetic */}
                            <div className={`absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r ${item.grad} ${isHidden ? 'opacity-20 group-hover:opacity-100' : 'opacity-70 group-hover:opacity-100'} transition-opacity duration-300`}></div>

                            {/* Decorative Blur Bubble (very subtle) */}
                            {!isHidden && (
                                <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-700 blur-2xl bg-gradient-to-br ${item.grad}`}></div>
                            )}

                            <div className="flex items-center justify-between w-full mb-6 z-10 transition-transform duration-300 group-hover:translate-x-1">
                                <item.icon size={26} className={`drop-shadow-sm transition-colors duration-300 ${isHidden ? 'text-gray-500' : item.color}`} />
                                {badge && !isHidden && (
                                    <span className="flex items-center justify-center text-[11px] font-medium text-white bg-[#ff3366] h-6 px-3 rounded-full shadow-md animate-pulse">
                                        {badge > 9 ? '9+' : badge} Pending
                                    </span>
                                )}
                            </div>

                            <div className="z-10 transition-transform duration-300 group-hover:translate-x-1">
                                <h3 className={`text-lg font-light mb-0.5 tracking-tight transition-colors ${isHidden ? (isDark ? 'text-gray-400' : 'text-gray-500') : (isDark ? 'text-gray-100' : 'text-gray-800')}`}>
                                    {item.label}
                                </h3>
                                <p className={`text-sm leading-relaxed font-light ${isHidden ? (isDark ? 'text-[#a1a5b7]/50' : 'text-gray-400') : (isDark ? 'text-[#a1a5b7]' : 'text-gray-500')}`}>
                                    {item.description}
                                </p>
                            </div>

                            <div className="absolute bottom-4 right-4 z-20 flex space-x-2">
                                <button
                                    onClick={(e) => toggleHidden(e, item.id)}
                                    className={`p-1.5 rounded-full outline-none transition-colors duration-300 ${isDark ? 'hover:bg-[#2b2b40]' : 'hover:bg-gray-100'}`}
                                    title={isHidden ? "Show Card" : "Hide Card"}
                                >
                                    {isHidden ? (
                                        <EyeOff size={16} className={`transition-colors duration-300 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} />
                                    ) : (
                                        <Eye size={16} className={`transition-colors duration-300 opacity-0 group-hover:opacity-100 ${isDark ? 'text-[#3a3a5a] hover:text-gray-300' : 'text-gray-200 hover:text-gray-500'}`} />
                                    )}
                                </button>

                                <button
                                    onClick={(e) => toggleFavorite(e, item.id)}
                                    className={`p-1.5 rounded-full outline-none transition-colors duration-300 ${isDark ? 'hover:bg-[#2b2b40]' : 'hover:bg-gray-100'}`}
                                    title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                                >
                                    <Heart
                                        size={18}
                                        className={`transition-colors duration-300 ${isFav ? 'fill-[#ff3366] text-[#ff3366]' : (isDark ? 'text-[#3a3a5a] hover:text-[#ff3366]' : 'text-gray-200 hover:text-[#ff3366]')}`}
                                    />
                                </button>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    );
};

export default DashboardHome;
