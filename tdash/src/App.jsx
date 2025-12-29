import React, { useState, useEffect } from 'react';
import { auth } from './lib/auth';
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
import SettingsView from './features/SettingsView';
import LoginView from './features/LoginView';
import VenuesView from './features/VenuesView';

const App = () => {
    const [activeView, setActiveView] = useState(localStorage.getItem('lastActiveView') || 'dashboard');
    const [managedEvent, setManagedEvent] = useState(null);
    const [isDark, setIsDark] = useState(true);
    const [user, setUser] = useState(auth.getCurrentUser());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check auth status on load
        const currentUser = auth.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
        }
        setLoading(false);
    }, []);

    const handleLogin = (userData) => {
        setUser(userData);
    };

    const handleLogout = () => {
        auth.logout();
        setUser(null);
        setActiveView('dashboard');
    };

    const toggleTheme = () => setIsDark(!isDark);

    // Reset managed event when switching views
    // Reset managed event when switching views
    const handleViewChange = (view) => {
        setActiveView(view);
        localStorage.setItem('lastActiveView', view);
        setManagedEvent(null);
    };

    const renderContent = () => {

        const props = { isDark };

        if (managedEvent) {
            return (
                <EventManagementDashboard
                    event={managedEvent}
                    onBack={() => setManagedEvent(null)}
                    user={user}
                    onUpdate={(updatedEvent) => setManagedEvent(updatedEvent)}
                    {...props}
                />
            );
        }

        switch (activeView) {
            case 'dashboard': return <DashboardHome {...props} />;
            case 'events': return <EventsView onManageEvent={setManagedEvent} user={user} {...props} />;
            case 'analytics': return <AnalyticsView {...props} />;
            case 'marketing': return <ComingSoonView title="Marketing Hub" icon="Megaphone" isDark={isDark} />;
            case 'todo': return <TodoView {...props} />;
            case 'personal-todo': return <PersonalTodoView {...props} />;
            case 'team': return <TeamView {...props} />;
            case 'social': return <SocialDashboard {...props} />;
            case 'orders': return <ComingSoonView title="Orders Management" {...props} />;
            case 'scanners': return <ComingSoonView title="Scanners" {...props} />;
            case 'promo': return <ComingSoonView title="Promo Codes" {...props} />;
            case 'creative': return <CreativeComposer {...props} />;
            case 'venues': return <VenuesView isDark={isDark} user={user} />;
            case 'settings': return <SettingsView {...props} />;
            default: return <DashboardHome {...props} />;
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-[#121212] opacity-0 animate-fade-in"></div>;
    }

    if (!user) {
        return <LoginView onLogin={handleLogin} />;
    }

    return (
        <DashboardLayout
            activeView={managedEvent ? 'events' : activeView}
            onNavigate={handleViewChange}
            isDark={isDark}
            toggleTheme={toggleTheme}
            user={user}
            onLogout={handleLogout}
        >
            {renderContent()}
        </DashboardLayout>
    );
};

export default App;
