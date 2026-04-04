import React, { useState } from 'react';
import {
    ArrowRight,
    Loader,
    Lock,
    Mail,
    Radio,
    ScanLine,
    ShieldCheck,
} from 'lucide-react';
import { auth } from '../lib/auth';

const operationalPillars = [
    { label: 'Events', value: 'Build and manage live experiences.' },
    { label: 'Reviews', value: 'Keep approvals and revisions in sync.' },
    { label: 'Operations', value: 'Run sales, scanners, and venue workflows.' },
];

const securityPoints = [
    {
        icon: ShieldCheck,
        title: 'Secure access',
        detail: 'Protected sign-in for your workspace.',
        iconClassName: 'text-[#8b3dff]',
        iconSurfaceClassName: 'bg-[#8b3dff]/10',
    },
    {
        icon: Radio,
        title: 'Live updates',
        detail: 'Stay current across your account.',
        iconClassName: 'text-[#6b7fae]',
        iconSurfaceClassName: 'bg-[#6b7fae]/10',
    },
    {
        icon: ScanLine,
        title: 'Connected tools',
        detail: 'Your workflows stay in one place.',
        iconClassName: 'text-[#d66bb3]',
        iconSurfaceClassName: 'bg-[#d66bb3]/10',
    },
];

const supportItems = [
    { label: 'New access', value: 'Contact your Tixmo administrator to provision your workspace.' },
    { label: 'Password help', value: 'If you cannot sign in, request a reset from your team.' },
];

const panelClass = 'relative overflow-hidden rounded-md border border-[#2b2b40] bg-[#1e1e2d]';
const inputClassName = 'w-full rounded-md border border-[#2b2b40] bg-[#151521] px-12 py-3 text-sm font-light text-gray-100 outline-none transition focus:border-[#6b7fae] placeholder:text-[#5e6278]';
const eyebrowClass = 'text-[11px] uppercase tracking-[0.24em] text-[#8f94aa]';
const accentBarBaseClass = 'absolute left-0 top-0 h-[3px] w-full';
const primaryAccentBarClass = 'bg-[#b235fb] opacity-85';
const secondaryAccentBarClass = 'bg-[#6b7fae] opacity-75';

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
        <div className="min-h-screen bg-[#141625] text-white">
            <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.1),_transparent_24%),linear-gradient(180deg,_#141625_0%,_#121420_100%)]">
                <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
                    <section className={`${panelClass} page-section-enter mb-6 px-6 py-5 sm:px-8`} style={{ '--section-delay': '60ms' }}>
                        <div className={`${accentBarBaseClass} ${primaryAccentBarClass}`} />
                        <img
                            src="https://tixmo.co/images/tixmo_logo.png"
                            alt="Tixmo"
                            className="h-11 w-auto object-contain"
                        />
                    </section>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_430px]">
                            <section className={`${panelClass} page-section-enter px-6 py-6`} style={{ '--section-delay': '100ms' }}>
                                <div className={`${accentBarBaseClass} ${secondaryAccentBarClass}`} />
                                <div className="flex items-center justify-between gap-3">
                                    <p className={eyebrowClass}>Workspace</p>
                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#c8cbda]">
                                        Live
                                    </span>
                                </div>
                                <div className="mt-5 divide-y divide-[#2b2b40]">
                                    {operationalPillars.map(({ label, value }) => (
                                        <div key={label} className="py-4 first:pt-0 last:pb-0">
                                            <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f94aa]">{label}</p>
                                            <p className="mt-2 text-sm leading-7 text-gray-200">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className={`${panelClass} page-section-enter px-6 py-6`} style={{ '--section-delay': '140ms' }}>
                                <div className={`${accentBarBaseClass} ${secondaryAccentBarClass}`} />
                                <p className={eyebrowClass}>Access</p>
                                <div className="mt-5 divide-y divide-[#2b2b40]">
                                    {securityPoints.map(({ icon: Icon, title, detail, iconClassName, iconSurfaceClassName }) => (
                                        <div key={title} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${iconSurfaceClassName} ${iconClassName}`}>
                                                <Icon size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-100">{title}</p>
                                                <p className="mt-1 text-sm leading-6 text-[#a1a5b7]">{detail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className={`${panelClass} page-section-enter flex flex-col px-6 py-6 xl:row-span-2`} style={{ '--section-delay': '180ms' }}>
                                <div className={`${accentBarBaseClass} ${secondaryAccentBarClass}`} />

                                {notice && (
                                    <div className="rounded-md border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                                        {notice}
                                    </div>
                                )}

                                {error && (
                                    <div className="mt-4 rounded-md border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                                    <div className="space-y-2">
                                        <label className="ml-1 text-[11px] uppercase tracking-[0.22em] text-[#8f94aa]">
                                            Email Address
                                        </label>
                                        <div className="group relative">
                                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e6278] transition-colors group-focus-within:text-[#7f92bd]" />
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
                                        <label className="ml-1 text-[11px] uppercase tracking-[0.22em] text-[#8f94aa]">
                                            Password
                                        </label>
                                        <div className="group relative">
                                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e6278] transition-colors group-focus-within:text-[#7f92bd]" />
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
                                        className="flex w-full items-center justify-center gap-2 rounded-md bg-[#b235fb] px-5 py-3 text-sm font-medium uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#bf52fc] disabled:cursor-not-allowed disabled:opacity-60"
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

                            </section>

                            <section className={`${panelClass} page-section-enter px-6 py-6 xl:col-span-2`} style={{ '--section-delay': '220ms' }}>
                                <div className={`${accentBarBaseClass} ${secondaryAccentBarClass}`} />
                                <p className={eyebrowClass}>Support</p>
                                <div className="mt-5 grid gap-4 md:grid-cols-2">
                                    {supportItems.map(({ label, value }) => (
                                        <div key={label} className="rounded-md border border-[#2b2b40] bg-[#151521] px-4 py-4">
                                            <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f94aa]">{label}</p>
                                            <p className="mt-2 text-sm leading-6 text-gray-200">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginView;
