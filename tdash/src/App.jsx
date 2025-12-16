import React, { useState, useEffect } from 'react';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './features/DashboardHome';
import EventsView from './features/EventsView';
import AnalyticsView from './features/AnalyticsView';
import TodoView from './features/TodoView';
import TeamView from './features/TeamView';
import ComingSoonView from './features/ComingSoonView';
import EventManagementDashboard from './features/EventManagementDashboard';
import SocialDashboard from './features/SocialDashboard';
import CreativeComposer from './features/CreativeComposer';
import PersonalTodoView from './features/PersonalTodoView';

const App = () => {
    const [activeView, setActiveView] = useState('dashboard');
    const [managedEvent, setManagedEvent] = useState(null);
    const [isDark, setIsDark] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const toggleTheme = () => setIsDark(!isDark);

    // Reset managed event when switching views
    const handleViewChange = (view) => {
        setActiveView(view);
        setManagedEvent(null);
    };

    const renderContent = () => {
        const props = { isDark };

        if (managedEvent) {
            return (
                <EventManagementDashboard
                    event={managedEvent}
                    onBack={() => setManagedEvent(null)}
                    {...props}
                />
            );
        }

        switch (activeView) {
            case 'dashboard': return <DashboardHome {...props} />;
            case 'events': return <EventsView onManageEvent={setManagedEvent} {...props} />;
            case 'analytics': return <AnalyticsView {...props} />;
            case 'todo': return <TodoView {...props} />;
            case 'personal-todo': return <PersonalTodoView {...props} />;
            case 'team': return <TeamView {...props} />;
            case 'social': return <SocialDashboard {...props} />;
            case 'orders': return <ComingSoonView title="Orders Management" {...props} />;
            case 'scanners': return <ComingSoonView title="Scanners" {...props} />;
            case 'promo': return <ComingSoonView title="Promo Codes" {...props} />;
            case 'creative': return <CreativeComposer {...props} />;
            case 'venues': return <ComingSoonView title="Venues" {...props} />;
            default: return <DashboardHome {...props} />;
        }
    };

    return (
        <DashboardLayout
            activeView={managedEvent ? 'events' : activeView}
            onNavigate={handleViewChange}
            isDark={isDark}
            toggleTheme={toggleTheme}
        >
            {loading ? (
                <div className="flex items-center justify-center h-full opacity-0 animate-fade-in"></div>
            ) : (
                renderContent()
            )}
        </DashboardLayout>
    );
};

export default App;
