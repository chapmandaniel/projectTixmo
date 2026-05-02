import React, { useState, useEffect } from 'react';
import {
    Calendar, BarChart3,
    Users, CheckSquare,
    MessageCircle, Wand2, Settings, CheckCircle, BrainCircuit, Image
} from 'lucide-react';
import api from '../lib/api';
import {
    DASHBOARD_HOME_DEFAULT_FAVORITES,
    DASHBOARD_HOME_DEFAULT_HIDDEN,
    DASHBOARD_HOME_TRUTH_ORDER,
    DASHBOARD_HOME_TRUTH_VERSION,
} from '../lib/dashboardTruth';
import { DashboardModuleTile, DashboardPage, DashboardTitleBar } from '../components/dashboard/DashboardPrimitives';

const gridItems = [
    { id: 'events', icon: Calendar, label: 'Event Manager', description: 'Create events and manage sales, scanners, and venues from one dashboard.', accent: 'from-pink-500 to-orange-400', iconClassName: 'text-pink-500' },
    { id: 'todo', icon: CheckSquare, label: 'Task Manager', description: 'Collaborate, assign work, and track operational follow-through.', accent: 'from-indigo-400 to-purple-500', iconClassName: 'text-indigo-400' },
    { id: 'team', icon: Users, label: 'Team Members', description: 'Manage organization access.', accent: 'from-gray-600 to-gray-700', iconClassName: 'text-gray-500' },
    { id: 'social', icon: MessageCircle, label: 'Social', description: 'Placeholder reserved for future audience tools.', accent: 'slate', iconClassName: 'text-slate-400' },
    { id: 'creative', icon: Wand2, label: 'ProMo', description: 'Placeholder reserved for future campaign tools.', accent: 'slate', iconClassName: 'text-slate-400' },
    { id: 'assets', icon: Image, label: 'Asset Library', description: 'Browse uploaded creative, preview versions, and copy share links for internal or external handoff.', accent: 'from-sky-500 to-cyan-400', iconClassName: 'text-sky-400' },
    { id: 'approvals', icon: CheckCircle, label: 'Review Portal', description: 'Review pending requests.', accent: 'from-lime-400 to-emerald-500', iconClassName: 'text-lime-400' },
    { id: 'quantmo', icon: BrainCircuit, label: 'QuantMo', description: 'Placeholder reserved for future intelligence tools.', accent: 'slate', iconClassName: 'text-slate-400' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics', description: 'Deep dive into your metrics.', accent: 'from-blue-400 to-indigo-600', iconClassName: 'text-blue-400' },
    { id: 'settings', icon: Settings, label: 'Settings', description: 'Configure application preferences.', accent: 'from-gray-700 to-gray-800', iconClassName: 'text-gray-500' },
];

const DashboardHome = ({ isDark, user }) => {
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const [favorites, setFavorites] = useState(() => {
        try {
            const version = localStorage.getItem('tixmo_dashboard_prefs_version');
            const saved = localStorage.getItem('tixmo_dashboard_favorites');
            if (version !== DASHBOARD_HOME_TRUTH_VERSION) return DASHBOARD_HOME_DEFAULT_FAVORITES;
            if (!saved) return DASHBOARD_HOME_DEFAULT_FAVORITES;
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : DASHBOARD_HOME_DEFAULT_FAVORITES;
        } catch (e) {
            return DASHBOARD_HOME_DEFAULT_FAVORITES;
        }
    });

    const [hiddenCards, setHiddenCards] = useState(() => {
        try {
            const version = localStorage.getItem('tixmo_dashboard_prefs_version');
            const saved = localStorage.getItem('tixmo_dashboard_hidden');
            if (version !== DASHBOARD_HOME_TRUTH_VERSION) return DASHBOARD_HOME_DEFAULT_HIDDEN;
            if (!saved) return DASHBOARD_HOME_DEFAULT_HIDDEN;
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed : DASHBOARD_HOME_DEFAULT_HIDDEN;
        } catch (e) {
            return DASHBOARD_HOME_DEFAULT_HIDDEN;
        }
    });

    const toggleFavorite = (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        setFavorites(prev => {
            const newFavs = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
            localStorage.setItem('tixmo_dashboard_prefs_version', DASHBOARD_HOME_TRUTH_VERSION);
            localStorage.setItem('tixmo_dashboard_favorites', JSON.stringify(newFavs));
            return newFavs;
        });
    };

    const toggleHidden = (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        setHiddenCards(prev => {
            const newHidden = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
            localStorage.setItem('tixmo_dashboard_prefs_version', DASHBOARD_HOME_TRUTH_VERSION);
            localStorage.setItem('tixmo_dashboard_hidden', JSON.stringify(newHidden));
            return newHidden;
        });
    };

    useEffect(() => {
        try {
            localStorage.setItem('tixmo_dashboard_prefs_version', DASHBOARD_HOME_TRUTH_VERSION);
            if (!localStorage.getItem('tixmo_dashboard_favorites')) {
                localStorage.setItem('tixmo_dashboard_favorites', JSON.stringify(DASHBOARD_HOME_DEFAULT_FAVORITES));
            }
            if (!localStorage.getItem('tixmo_dashboard_hidden')) {
                localStorage.setItem('tixmo_dashboard_hidden', JSON.stringify(DASHBOARD_HOME_DEFAULT_HIDDEN));
            }
        } catch (error) {
            console.error('Failed to persist dashboard defaults', error);
        }
    }, []);

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

        if (aHidden && !bHidden) return 1;
        if (!aHidden && bHidden) return -1;

        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;

        return DASHBOARD_HOME_TRUTH_ORDER.indexOf(a.id) - DASHBOARD_HOME_TRUTH_ORDER.indexOf(b.id);
    });

    return (
        <DashboardPage className="mx-auto max-w-[1680px] space-y-8">
            <DashboardTitleBar
                isDark={isDark}
                title={`Welcome back, ${user?.firstName || 'User'}`}
                description="Access all your modules and tools from your control center."
                glowTopClassName="bg-fuchsia-500/10"
                glowBottomClassName="bg-cyan-400/10"
            />
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-4">
                {sortedItems.map((item) => {
                    const badge = item.id === 'approvals' && pendingApprovalsCount > 0 ? pendingApprovalsCount : null;
                    const isFav = favorites.includes(item.id);
                    const isHidden = hiddenCards.includes(item.id);

                    return (
                        <DashboardModuleTile
                            key={item.id}
                            to={`/${item.id}`}
                            item={item}
                            badge={badge}
                            isDark={isDark}
                            isFavorite={isFav}
                            isHidden={isHidden}
                            onToggleFavorite={(e) => toggleFavorite(e, item.id)}
                            onToggleHidden={(e) => toggleHidden(e, item.id)}
                            data-card-id={item.id}
                            data-hidden={isHidden ? 'true' : 'false'}
                            data-testid={`dashboard-card-${item.id}`}
                            className="focus-visible:ring-fuchsia-500"
                        />
                    );
                })}
            </div>
        </DashboardPage>
    );
};

export default DashboardHome;
