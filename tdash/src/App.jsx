import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { auth } from './lib/auth';
import {
    ACCESS_TOKEN_KEY,
    AUTH_EXPIRED_EVENT,
    AUTH_EXPIRED_REASONS,
    SESSION_TIMEOUT_MINUTES,
    USER_STORAGE_KEY,
    createInactivityManager,
} from './lib/session';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './features/DashboardHome';
import EventsView from './features/EventsView';
import AnalyticsView from './features/AnalyticsView';
import QuantMoView from './features/QuantMoView';
import TodoView from './features/TodoView';
import TeamView from './features/TeamView';
import ComingSoonView from './features/ComingSoonView';
import EventManagementDashboard from './features/EventManagementDashboard';
import SocialDashboard from './features/SocialDashboard';
import CreativeComposer from './features/CreativeComposer';
import SettingsView from './features/SettingsView';
import LoginView from './features/LoginView';
import VenuesView from './features/VenuesView';
import ApprovalsDashboard from './features/ApprovalsDashboard';
import OrdersView from './features/OrdersView';
import DevDashboard from './features/DevDashboard';
import ScannersView from './features/ScannersView';

import WaitingRoomView from './features/WaitingRoomView';
import GlobalErrorNotification from './components/GlobalErrorNotification';
import ExternalReviewPage from './pages/ExternalReviewPage';
import ErrorBoundary from './components/ErrorBoundary';

const AppContent = ({ user, handleLogout, isDark, toggleTheme, globalError, setGlobalError }) => {
    const location = useLocation();
    const navigate = useNavigate();

    // The layout needs to know the active view for the sidebar.
    // Example: "/analytics" -> "analytics", "/events/123" -> "events"
    const path = location.pathname.split('/')[1] || 'dashboard';

    // To gracefully handle DashboardHome's expectations without refactoring it heavily yet
    const handleNavigationEvent = (view) => {
        navigate(`/${view}`);
    };

    return (
        <ErrorBoundary isDark={isDark}>
            <DashboardLayout
                activeView={path}
                onNavigate={handleNavigationEvent}
                isDark={isDark}
                toggleTheme={toggleTheme}
                user={user}
                onLogout={handleLogout}
            >
                <Routes>
                    <Route path="/dashboard" element={<DashboardHome user={user} onNavigate={handleNavigationEvent} isDark={isDark} />} />
                    <Route path="/events" element={<EventsView user={user} isDark={isDark} />} />
                    <Route path="/events/:eventId/*" element={<EventManagementDashboard user={user} isDark={isDark} />} />
                    <Route path="/analytics" element={<AnalyticsView isDark={isDark} />} />
                    <Route path="/quantmo" element={<QuantMoView isDark={isDark} />} />
                    <Route path="/todo" element={<TodoView isDark={isDark} />} />
                    <Route path="/personal-todo" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/team" element={<TeamView isDark={isDark} />} />
                    <Route path="/social" element={<SocialDashboard isDark={isDark} />} />
                    <Route path="/orders" element={<OrdersView isDark={isDark} />} />
                    <Route path="/settings" element={<SettingsView isDark={isDark} />} />
                    <Route path="/creative" element={<CreativeComposer isDark={isDark} />} />
                    <Route path="/venues" element={<VenuesView isDark={isDark} user={user} />} />
                    <Route path="/approvals" element={<ApprovalsDashboard isDark={isDark} user={user} />} />
                    <Route path="/dev" element={<DevDashboard isDark={isDark} user={user} />} />

                    {/* Coming Soon hubs */}
                    <Route path="/marketing" element={<ComingSoonView title="Marketing Hub" icon="Megaphone" isDark={isDark} />} />
                    <Route path="/scanners" element={<ScannersView isDark={isDark} user={user} />} />
                    <Route path="/promo" element={<Navigate to="/dashboard" replace />} />

                    {/* Fallback to dashboard */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>

                <GlobalErrorNotification
                    error={globalError}
                    onClose={() => setGlobalError(null)}
                    isDark={isDark}
                />
            </DashboardLayout>
        </ErrorBoundary>
    );
};

const App = () => {
    const [isDark, setIsDark] = useState(true);
    const [user, setUser] = useState(auth.getCurrentUser());
    const [loading, setLoading] = useState(true);
    const [showWaitingRoom, setShowWaitingRoom] = useState(false);
    const [globalError, setGlobalError] = useState(null);
    const [authNotice, setAuthNotice] = useState('');

    const inactivityMessage = `You were signed out after ${SESSION_TIMEOUT_MINUTES} minutes of inactivity.`;

    useEffect(() => {
        // Check auth status on load
        const currentUser = auth.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
        }
        setLoading(false);

        // Listen for waiting room events
        const handleWaitingRoom = () => setShowWaitingRoom(true);
        window.addEventListener('tixmo:waiting-room', handleWaitingRoom);

        // Listen for global errors
        const handleGlobalError = (event) => {
            const error = event.detail;
            if (error?.status !== 401 && error?.status !== 503) {
                setGlobalError({
                    message: error?.message || 'An unexpected system error occurred.',
                    code: error?.status || 'UNKNOWN'
                });
            }
        };
        window.addEventListener('tixmo:global-error', handleGlobalError);

        const handleAuthExpired = (event) => {
            const reason = event.detail?.reason;

            if (reason === AUTH_EXPIRED_REASONS.idle) {
                setAuthNotice(inactivityMessage);
            } else {
                setAuthNotice('Your session expired. Sign in again to continue.');
            }

            setUser(null);
        };
        window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

        const handleStorage = (event) => {
            if (event.key === ACCESS_TOKEN_KEY && !event.newValue) {
                setUser(null);
            }

            if (event.key === USER_STORAGE_KEY && event.newValue) {
                try {
                    setUser(JSON.parse(event.newValue));
                } catch (error) {
                    console.warn('Failed to sync user from storage', error);
                }
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('tixmo:waiting-room', handleWaitingRoom);
            window.removeEventListener('tixmo:global-error', handleGlobalError);
            window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
            window.removeEventListener('storage', handleStorage);
        };
    }, [inactivityMessage]);

    useEffect(() => {
        if (!user) {
            return undefined;
        }

        const inactivityManager = createInactivityManager({
            onTimeout: () => {
                auth.logout({ notifyServer: false }).finally(() => {
                    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
                        detail: { reason: AUTH_EXPIRED_REASONS.idle },
                    }));
                });
            },
        });

        inactivityManager.start();

        return () => {
            inactivityManager.stop();
        };
    }, [user]);

    useEffect(() => {
        const backgroundColor = isDark ? '#151521' : '#fafafa';
        document.documentElement.style.backgroundColor = backgroundColor;
        document.body.style.backgroundColor = backgroundColor;

        const root = document.getElementById('root');
        if (root) {
            root.style.backgroundColor = backgroundColor;
        }
    }, [isDark]);

    const handleLogin = (userData) => {
        setAuthNotice('');
        setUser(userData);
    };

    const handleLogout = () => {
        setAuthNotice('');
        auth.logout();
        setUser(null);
    };

    const toggleTheme = () => setIsDark(!isDark);

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-[#121212] opacity-0 animate-fade-in"></div>;
    }

    return (
        <Routes>
            {/* External unauthenticated routes */}
            <Route path="/review/*" element={<ExternalReviewPage />} />

            {/* Main Application */}
            <Route path="*" element={
                showWaitingRoom ? (
                    <WaitingRoomView onRetry={() => setShowWaitingRoom(false)} />
                ) : !user ? (
                    <LoginView onLogin={handleLogin} notice={authNotice} />
                ) : (
                    <AppContent
                        user={user}
                        handleLogout={handleLogout}
                        isDark={isDark}
                        toggleTheme={toggleTheme}
                        globalError={globalError}
                        setGlobalError={setGlobalError}
                    />
                )
            } />
        </Routes>
    );
};

export default App;
