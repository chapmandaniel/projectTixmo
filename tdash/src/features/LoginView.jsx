import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader, Lock, Mail } from 'lucide-react';
import { auth } from '../lib/auth';
import loginLandscape from '../assets/login-landscape.svg';

const inputClassName = 'w-full rounded-md border border-[#4a4266] bg-[#2a253a] px-4 py-3 text-sm font-light text-[#f2f0fb] outline-none transition placeholder:text-[#8d86a5] focus:border-[#8164ff] focus:bg-[#2f2942]';

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
        <div className="min-h-screen overflow-hidden bg-[#7f7891] text-white">
            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_32%),linear-gradient(180deg,_#827a94_0%,_#706a82_100%)] px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1240px] items-center justify-center">
                    <section className="login-panel-reveal grid w-full max-w-[980px] overflow-hidden rounded-[18px] border border-white/12 bg-[#252132] shadow-[0_30px_90px_rgba(19,16,31,0.42)] lg:grid-cols-[1.08fr_0.92fr]">
                        <div className="relative min-h-[420px] overflow-hidden border-b border-white/10 lg:min-h-[640px] lg:border-b-0 lg:border-r lg:border-r-white/10">
                            <img
                                src={loginLandscape}
                                alt="Abstract Tixmo landscape"
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,14,28,0.08)_0%,rgba(15,13,24,0.15)_32%,rgba(15,13,24,0.46)_100%)]" />

                            <div className="relative flex h-full flex-col justify-between p-6 sm:p-8">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="rounded-full border border-white/16 bg-white/8 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.24em] text-white/92 backdrop-blur-sm">
                                        Tixmo
                                    </div>
                                    <a
                                        href="https://tixmo.co"
                                        className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/78 backdrop-blur-sm transition hover:bg-white/12 hover:text-white"
                                    >
                                        <ArrowLeft size={13} />
                                        Back to website
                                    </a>
                                </div>

                                <div className="max-w-[16rem]">
                                    <p className="text-[1.55rem] font-light leading-[1.15] tracking-tight text-white sm:text-[1.85rem]">
                                        Run live work
                                        <br />
                                        without losing the thread.
                                    </p>
                                    <p className="mt-3 text-sm font-light leading-6 text-white/70">
                                        Events, approvals, operations, and team access in one control center.
                                    </p>
                                    <div className="mt-6 h-[3px] w-16 rounded-full bg-white/92" />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col justify-center bg-[#252132] px-6 py-7 sm:px-8 sm:py-8 lg:px-10">
                            <div className="max-w-[360px]">
                                <p className="text-[0.72rem] uppercase tracking-[0.26em] text-[#a79fbe]">
                                    Workspace Access
                                </p>
                                <h1 className="mt-4 text-[2rem] font-light tracking-tight text-[#f7f5ff] sm:text-[2.45rem]">
                                    Sign in
                                </h1>
                                <p className="mt-3 text-sm font-light leading-6 text-[#aaa3bf]">
                                    Enter your credentials to continue into your Tixmo workspace.
                                </p>
                            </div>

                            {notice ? (
                                <div className="mt-6 rounded-md border border-amber-300/16 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                                    {notice}
                                </div>
                            ) : null}

                            {error ? (
                                <div className="mt-4 rounded-md border border-rose-300/16 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-50">
                                    {error}
                                </div>
                            ) : null}

                            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[0.68rem] uppercase tracking-[0.22em] text-[#a79fbe]">
                                        Email Address
                                    </label>
                                    <div className="group relative">
                                        <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8d86a5] transition group-focus-within:text-[#c5bbf8]" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            className={`${inputClassName} pl-11`}
                                            placeholder="name@example.com"
                                            autoComplete="email"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[0.68rem] uppercase tracking-[0.22em] text-[#a79fbe]">
                                        Password
                                    </label>
                                    <div className="group relative">
                                        <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8d86a5] transition group-focus-within:text-[#c5bbf8]" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(event) => setPassword(event.target.value)}
                                            className={`${inputClassName} pl-11`}
                                            placeholder="Enter your password"
                                            autoComplete="current-password"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-4 pt-1">
                                    <label className="inline-flex items-center gap-2 text-xs font-light text-[#b7afcc]">
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="h-3.5 w-3.5 rounded border border-[#5a5370] bg-[#2a253a] text-[#8d69ff] focus:ring-[#8d69ff]"
                                        />
                                        Keep me signed in
                                    </label>
                                    <span className="text-xs font-light text-[#8f89a5]">
                                        Secure workspace access
                                    </span>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#8c63ff] px-5 py-3 text-sm font-light text-white transition hover:bg-[#9b79ff] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? (
                                        <>
                                            <Loader size={17} className="animate-spin" />
                                            Continue
                                        </>
                                    ) : (
                                        <>
                                            Continue
                                            <ArrowRight size={17} />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 flex items-center gap-3">
                                <div className="h-px flex-1 bg-white/10" />
                                <span className="text-[0.66rem] uppercase tracking-[0.22em] text-[#8f89a5]">
                                    Team-managed access
                                </span>
                                <div className="h-px flex-1 bg-white/10" />
                            </div>

                            <div className="mt-5 grid gap-3 text-xs font-light text-[#a79fbe] sm:grid-cols-2">
                                <div className="rounded-md border border-white/10 bg-[#201c2d] px-4 py-3">
                                    New access is created by your Tixmo administrator.
                                </div>
                                <div className="rounded-md border border-white/10 bg-[#201c2d] px-4 py-3">
                                    If you’re locked out, ask your team to reset your password.
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default LoginView;
