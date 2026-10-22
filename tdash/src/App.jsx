import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { auth } from './lib/auth';
import {
    ACCESS_TOKEN_KEY,
    AUTH_EXPIRED_EVENT,
    AUTH_EXPIRED_REASONS,
    SESSION_TIMEOUT_MINUTES,
    USER_STORAGE_KEY,
    createInactivityManager,
    getUserCacheIdentity,
    getSessionGeneration,
} from './lib/session';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPlaceholderView from './features/DashboardPlaceholderView';
import LoginView from './features/LoginView';
import AcceptInvitationView from './features/AcceptInvitationView';
import { BrainCircuit, MessageCircle, Wand2 } from 'lucide-react';

import GlobalErrorNotification from './components/GlobalErrorNotification';
import ErrorBoundary from './components/ErrorBoundary';

const DashboardHome = lazy(() => import('./features/DashboardHome'));
const EventsView = lazy(() => import('./features/EventsView'));
const AnalyticsView = lazy(() => import('./features/AnalyticsView'));
const TodoView = lazy(() => import('./features/TodoView'));
const TeamView = lazy(() => import('./features/TeamView'));
const EventManagementDashboard = lazy(() => import('./features/EventManagementDashboard'));
const AssetLibraryView = lazy(() => import('./features/AssetLibraryView'));
const SettingsView = lazy(() => import('./features/SettingsView'));
const VenuesView = lazy(() => import('./features/VenuesView'));
const ApprovalsDashboard = lazy(() => import('./features/ApprovalsDashboard'));
const OrdersView = lazy(() => import('./features/OrdersView'));
const DevDashboard = lazy(() => import('./features/DevDashboard'));
const ScannersView = lazy(() => import('./features/ScannersView'));
// Busy feedback must be immediately available without suspending the retained form.
import WaitingRoomView from './features/WaitingRoomView';
const ExternalReviewPage = lazy(() => import('./pages/ExternalReviewPage'));
const SharedAssetFolderPage = lazy(() => import('./pages/SharedAssetFolderPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const ScannerPage = lazy(() => import('./pages/ScannerPage'));
const EventOnSalePage = lazy(() => import('./pages/EventOnSalePage'));
const EventOnSalePreview = import.meta.env.DEV ? lazy(() => import('./pages/EventOnSalePreview')) : null;
const FestivalPreview = import.meta.env.DEV ? lazy(() => import('./pages/FestivalPage')) : null;
const FestivalEventPreview = import.meta.env.DEV ? lazy(() => import('./pages/FestivalPage').then(module => ({ default: module.FestivalEventPreview }))) : null;

const RouteFallback = ({ isDark = true }) => (
    <div className={`flex min-h-[280px] items-center justify-center rounded-md border text-sm font-light ${isDark ? 'border-dashboard-border bg-dashboard-panelMuted text-dashboard-muted' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
        Loading workspace...
    </div>
);

const PublicRouteFallback = ({ isDark = true }) => (
    <div className={`flex min-h-screen items-center justify-center text-sm font-light ${isDark ? 'bg-dashboard-shell text-dashboard-muted' : 'bg-slate-50 text-slate-500'}`}>
        Loading...
    </div>
);

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

    const betaHoldDescription = 'This module is outside the V1 beta scope and is hidden from the main workspace until the launch path is stable.';

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
                <Suspense fallback={<RouteFallback isDark={isDark} />}>
                    <Routes>
                        <Route path="/dashboard" element={<DashboardHome user={user} onNavigate={handleNavigationEvent} isDark={isDark} />} />
                        <Route path="/events" element={<EventsView user={user} isDark={isDark} />} />
                        <Route path="/events/:eventId/*" element={<EventManagementDashboard user={user} isDark={isDark} />} />
                        <Route path="/analytics" element={<AnalyticsView isDark={isDark} user={user} />} />
                        <Route path="/quantmo" element={<DashboardPlaceholderView isDark={isDark} title="QuantMo" icon={BrainCircuit} description={betaHoldDescription} badgeLabel="Outside V1 beta" />} />
                        <Route path="/todo" element={<TodoView isDark={isDark} user={user} />} />
                        <Route path="/personal-todo" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/team" element={<TeamView isDark={isDark} />} />
                        <Route path="/social" element={<DashboardPlaceholderView isDark={isDark} title="Social" icon={MessageCircle} description={betaHoldDescription} badgeLabel="Outside V1 beta" />} />
                        <Route path="/orders" element={<OrdersView isDark={isDark} />} />
                        <Route path="/settings" element={<SettingsView isDark={isDark} user={user} />} />
                        <Route path="/creative" element={<DashboardPlaceholderView isDark={isDark} title="ProMo" icon={Wand2} description={betaHoldDescription} badgeLabel="Outside V1 beta" />} />
                        <Route path="/assets" element={<AssetLibraryView isDark={isDark} />} />
                        <Route path="/venues" element={<VenuesView isDark={isDark} user={user} />} />
                        <Route path="/approvals" element={<ApprovalsDashboard isDark={isDark} user={user} />} />
                        <Route path="/dev" element={<DevDashboard isDark={isDark} user={user} />} />

                        {/* Coming Soon hubs */}
                        <Route path="/marketing" element={<DashboardPlaceholderView isDark={isDark} title="Marketing Hub" icon={MessageCircle} description={betaHoldDescription} badgeLabel="Outside V1 beta" />} />
                        <Route path="/scanners" element={<ScannersView isDark={isDark} user={user} />} />
                        <Route path="/promo" element={<Navigate to="/dashboard" replace />} />

                        {/* Fallback to dashboard */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </Suspense>

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
    const location = useLocation();
    const navigate = useNavigate();
    const latestLocation = useRef(location);
    latestLocation.current = location;
    const preservePublicLocation = () => {
        const current = latestLocation.current;
        const query = new URLSearchParams(current.search);
        return matchPath('/scan', current.pathname) || matchPath('/wallet', current.pathname) || matchPath('/e/:slug', current.pathname) || (matchPath('/checkout/:slug', current.pathname)
            && ['orderId', 'redirect_status', 'payment_intent', 'payment_intent_client_secret']
                .some((field) => query.has(field)));
    };
    const [isDark, setIsDark] = useState(true);
    const [user, setUser] = useState(auth.getCurrentUser());
    const [loading, setLoading] = useState(true);
    const [showWaitingRoom, setShowWaitingRoom] = useState(null);
    const [globalError, setGlobalError] = useState(null);
    const [authNotice, setAuthNotice] = useState('');
    const [redirectToDashboardAfterLogin, setRedirectToDashboardAfterLogin] = useState(false);

    const inactivityMessage = `You were signed out after ${SESSION_TIMEOUT_MINUTES} minutes of inactivity.`;

    useEffect(() => {
        // Check auth status on load
        const currentUser = auth.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
        }
        setLoading(false);

        // Listen for waiting room events
        const handleWaitingRoom = (event) => setShowWaitingRoom({ retryAfter: event.detail?.retryAfter || 5, receivedAt: Date.now() });
        window.addEventListener('tixmo:waiting-room', handleWaitingRoom);

        // Listen for global errors
        const handleGlobalError = (event) => {
            const error = event.detail;
            if (error?.status !== 401) {
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

            setRedirectToDashboardAfterLogin(false);
            if (!preservePublicLocation()) navigate('/dashboard', { replace: true });
            setUser(null);
        };
        window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

        const handleStorage = (event) => {
            if (event.key === ACCESS_TOKEN_KEY && !event.newValue) {
                setRedirectToDashboardAfterLogin(false);
                if (!preservePublicLocation()) navigate('/dashboard', { replace: true });
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
    }, [inactivityMessage, navigate]);

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

    useEffect(() => {
        if (!redirectToDashboardAfterLogin) {
            return;
        }

        if (!user || location.pathname === '/dashboard') {
            setRedirectToDashboardAfterLogin(false);
        }
    }, [location.pathname, redirectToDashboardAfterLogin, user]);

    const handleLogin = (userData) => {
        setAuthNotice('');
        setRedirectToDashboardAfterLogin(true);
        setUser(userData);
    };

    const handleCheckoutAuthenticated = (userData) => {
        setAuthNotice('');
        setRedirectToDashboardAfterLogin(false);
        setUser(userData);
    };

    const handleLogout = () => {
        setAuthNotice('');
        setRedirectToDashboardAfterLogin(false);
        auth.logout();
        navigate('/dashboard', { replace: true });
        setUser(null);
    };

    const toggleTheme = () => setIsDark(!isDark);

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-[#121212] opacity-0 animate-fade-in"></div>;
    }

    return (
        <>
        {showWaitingRoom ? <WaitingRoomView key={showWaitingRoom.receivedAt} retryAfter={showWaitingRoom.retryAfter} onRetry={() => setShowWaitingRoom(null)} /> : null}
        {matchPath('/checkout/:slug', location.pathname) ? <GlobalErrorNotification error={globalError} onClose={() => setGlobalError(null)} isDark={isDark} /> : null}
        <div inert={showWaitingRoom ? '' : undefined}>
        <Suspense fallback={<PublicRouteFallback isDark={isDark} />}>
            <Routes>
                {/* External unauthenticated routes */}
                <Route path="/scan" element={<ScannerPage isDark={isDark} />} />
                <Route path="/e/:slug" element={<EventOnSalePage />} />
                {EventOnSalePreview && <Route path="/preview/event-onsale" element={<EventOnSalePreview />} />}
                {FestivalPreview && <Route path="/preview/festival" element={<FestivalPreview />} />}
                {FestivalEventPreview && <Route path="/preview/festival/events/:slug" element={<FestivalEventPreview />} />}
                <Route path="/review/*" element={<ExternalReviewPage />} />
                <Route path="/invite" element={<AcceptInvitationView onAccepted={(nextUser) => { handleLogin(nextUser); navigate('/dashboard', { replace: true }); }} />} />
                <Route path="/assets/shared/:token" element={<SharedAssetFolderPage />} />
                <Route path="/checkout/:slug" element={<CheckoutPage key={`${getUserCacheIdentity(user)}:${getSessionGeneration()}`} user={user} onAuthenticated={handleCheckoutAuthenticated} />} />
                <Route path="/wallet" element={<WalletPage key={`${getUserCacheIdentity(user)}:${getSessionGeneration()}`} user={user} onAuthenticated={handleCheckoutAuthenticated} />} />

                {/* Main Application */}
                <Route path="*" element={
                    !user ? (
                        <LoginView onLogin={handleLogin} notice={authNotice} />
                    ) : redirectToDashboardAfterLogin && location.pathname !== '/dashboard' ? (
                        <Navigate to="/dashboard" replace />
                    ) : (
                        <AppContent
                            key={`${getUserCacheIdentity(user)}:${getSessionGeneration()}`}
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
        </Suspense>
        </div>
        </>
    );
};

export default App;
