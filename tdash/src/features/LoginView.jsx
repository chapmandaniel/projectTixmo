import React, { useState } from 'react';
import {
    ArrowRight,
    Loader,
    Lock,
    Mail,
    ShieldCheck,
} from 'lucide-react';
import {
    DashboardButton,
    DashboardSurface,
    DashboardTextInput,
} from '../components/dashboard/DashboardPrimitives';
import { auth } from '../lib/auth';

const LoginView = ({ onLogin, notice = '' }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        try {
            const user = await auth.login(email, password);
            onLogin(user);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-dashboard-shell text-zinc-100 selection:bg-dashboard-accent/30">
            <div className="dashboard-radial dashboard-grid flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
                <main className="grid w-full max-w-[1040px] gap-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
                    <section className="page-section-enter">
                        <a href="https://tixmo.co" className="inline-flex">
                            <img
                                src="https://tixmo.co/images/tixmo_logo.png"
                                alt="TixMo Logo"
                                className="h-16 w-auto object-contain sm:h-20"
                            />
                        </a>

                        <div className="mt-10 max-w-[34rem]">
                            <p className="text-xs font-light uppercase tracking-widest text-dashboard-subtleAlt">
                                Dashboard access
                            </p>
                            <p className="mt-4 max-w-xl text-base font-light leading-7 text-dashboard-muted sm:text-lg">
                                Sign in to your team workspace to manage the event operations your account has access to.
                            </p>
                        </div>
                    </section>

                    <DashboardSurface
                        as="section"
                        isDark
                        accent="brand"
                        className="page-section-enter p-6 [--section-delay:120ms] sm:p-8"
                    >
                        <div>
                            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-dashboard-control text-pink-300">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <p className="mt-6 text-xs font-light uppercase tracking-widest text-dashboard-subtleAlt">
                                Team-managed access
                            </p>
                            <h2 className="mt-3 text-4xl font-light tracking-tight text-zinc-100">
                                Sign in
                            </h2>
                            <p className="mt-3 text-sm font-light leading-6 text-dashboard-muted">
                                Use the credentials issued by your Tixmo administrator.
                            </p>
                        </div>

                        {notice ? (
                            <div className="mt-6 rounded-md border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                                {notice}
                            </div>
                        ) : null}

                        {error ? (
                            <div className="mt-4 rounded-md border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-50">
                                {error}
                            </div>
                        ) : null}

                        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                            <div className="space-y-2">
                                <label htmlFor="login-email" className="text-xs font-light uppercase tracking-widest text-dashboard-muted">
                                    Email address
                                </label>
                                <div className="group relative">
                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dashboard-subtleAlt transition-colors group-focus-within:text-pink-300" />
                                    <DashboardTextInput
                                        id="login-email"
                                        isDark
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        className="h-12 pl-11"
                                        placeholder="name@example.com"
                                        autoComplete="email"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="login-password" className="text-xs font-light uppercase tracking-widest text-dashboard-muted">
                                    Password
                                </label>
                                <div className="group relative">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dashboard-subtleAlt transition-colors group-focus-within:text-pink-300" />
                                    <DashboardTextInput
                                        id="login-password"
                                        isDark
                                        type="password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        className="h-12 pl-11"
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-4 border-t border-dashboard-border pt-5">
                                <label className="inline-flex items-center gap-2 text-xs font-light text-dashboard-muted">
                                    <input
                                        type="checkbox"
                                        defaultChecked
                                        className="h-3.5 w-3.5 rounded border-dashboard-border bg-dashboard-panel text-dashboard-accent focus:ring-dashboard-accent"
                                    />
                                    Keep me signed in
                                </label>
                                <span className="text-xs font-light text-dashboard-subtleAlt">
                                    Secure session
                                </span>
                            </div>

                            <DashboardButton
                                isDark
                                type="submit"
                                disabled={loading}
                                className="h-12 w-full"
                            >
                                {loading ? (
                                    <>
                                        <Loader className="h-4 w-4 animate-spin" />
                                        Continue
                                    </>
                                ) : (
                                    <>
                                        Continue
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </DashboardButton>
                        </form>
                    </DashboardSurface>
                </main>
            </div>
        </div>
    );
};

export default LoginView;
