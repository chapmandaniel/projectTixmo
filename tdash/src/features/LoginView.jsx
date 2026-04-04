import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, Loader, Radio, ScanLine, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/auth';

const operationalPillars = [
    { label: 'Create', value: 'Launch event pages, tiers, and offers without leaving the workspace.' },
    { label: 'Promote', value: 'Coordinate social, approvals, and sales signals from the same dashboard.' },
    { label: 'Greet', value: 'Keep scanners, venue access, and door operations aligned in real time.' },
    { label: 'Get Paid', value: 'Track orders, performance, and post-event follow-through from one view.' },
];

const securityPoints = [
    { icon: ShieldCheck, title: 'Secure sessions', detail: 'Short-lived access tokens with automatic refresh while you stay active.' },
    { icon: Radio, title: 'Live operations', detail: 'One dashboard for sales, approvals, notifications, and room status.' },
    { icon: ScanLine, title: 'Door-ready tools', detail: 'Scanner, venue, and attendee workflows stay tied to the same account.' },
];

const inputClassName = 'w-full rounded-2xl border border-white/10 bg-[rgba(8,17,29,0.85)] px-12 py-3.5 text-white placeholder:text-slate-500 focus:border-fuchsia-400/70 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 transition-all';

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
        <div
            className="relative min-h-screen overflow-hidden bg-[#050913] text-white selection:bg-fuchsia-500/30"
            style={{ fontFamily: "'Exo', sans-serif" }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Exo:ital,wght@0,100..900;1,100..900&display=swap');
            `}</style>

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.22),_transparent_28%),radial-gradient(circle_at_78%_18%,_rgba(168,85,247,0.18),_transparent_24%),linear-gradient(135deg,_#050913_0%,_#08111d_45%,_#050913_100%)]" />
            <div className="login-orb-float absolute -left-20 top-16 h-72 w-72 rounded-full bg-[rgba(217,70,239,0.18)] blur-3xl" />
            <div className="login-orb-float login-orb-float-delayed absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-[rgba(6,182,212,0.12)] blur-3xl" />

            <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
                <section className="flex items-center px-6 py-12 sm:px-10 lg:px-16 xl:px-20">
                    <div className="page-section-enter mx-auto w-full max-w-2xl space-y-10" style={{ '--section-delay': '70ms' }}>
                        <img
                            src="https://tixmo.co/images/tixmo_logo.png"
                            alt="Tixmo"
                            className="h-12 w-auto object-contain sm:h-14"
                        />

                        <div className="max-w-xl space-y-5">
                            <p className="text-xs font-medium uppercase tracking-[0.42em] text-fuchsia-200/75">Dashboard Access</p>
                            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                                Run events, sales, scanning, and approvals from one Tixmo control room.
                            </h1>
                            <p className="max-w-lg text-base leading-7 text-slate-300 sm:text-lg">
                                The dashboard now opens with the same dark-surface, high-contrast Tixmo styling used across the platform.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            {securityPoints.map(({ icon: Icon, title, detail }) => (
                                <div key={title} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                                    <div className="mb-4 inline-flex rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3 text-fuchsia-200">
                                        <Icon size={18} />
                                    </div>
                                    <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-white/90">{title}</h2>
                                    <p className="mt-3 text-sm leading-6 text-slate-300">{detail}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {operationalPillars.map(({ label, value }) => (
                                <div key={label} className="border-b border-white/10 pb-4">
                                    <p className="text-xs font-medium uppercase tracking-[0.28em] text-fuchsia-200/70">{label}</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="flex items-center justify-center border-t border-white/10 bg-[rgba(0,0,0,0.12)] px-6 py-10 backdrop-blur-2xl lg:border-l lg:border-t-0 lg:px-10">
                    <div className="page-section-enter w-full max-w-md" style={{ '--section-delay': '150ms' }}>
                        <div className="login-panel-reveal rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.96)_0%,rgba(7,11,20,0.96)_100%)] shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
                            <div className="p-8 sm:p-10">
                                <p className="text-xs font-medium uppercase tracking-[0.36em] text-fuchsia-200/70">Secure Login</p>
                                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">Sign in to Tixmo Dashboard</h2>
                                <p className="mt-3 text-sm leading-6 text-slate-400">
                                    Active sessions stay refreshed while you work. Idle sessions automatically close after 30 minutes.
                                </p>

                                {notice && (
                                    <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
                                        {notice}
                                    </div>
                                )}

                                {error && (
                                    <div className="mt-6 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                                    <div className="space-y-2">
                                        <label className="ml-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Email Address</label>
                                        <div className="group relative">
                                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-fuchsia-300" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(event) => setEmail(event.target.value)}
                                                className={inputClassName}
                                                placeholder="name@example.com"
                                                autoComplete="email"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="ml-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Password</label>
                                        <div className="group relative">
                                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-fuchsia-300" />
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(event) => setPassword(event.target.value)}
                                                className={inputClassName}
                                                placeholder="Enter your password"
                                                autoComplete="current-password"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-400 px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.22em] text-white shadow-[0_18px_36px_rgba(244,63,94,0.22)] transition-all hover:scale-[1.01] hover:shadow-[0_22px_44px_rgba(244,63,94,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader size={18} className="animate-spin" />
                                                Signing In
                                            </>
                                        ) : (
                                            <>
                                                Continue
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>

                        <p className="mt-6 text-center text-sm leading-6 text-slate-400">
                            Need access? Contact the Tixmo team to provision your organization and dashboard permissions.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default LoginView;
