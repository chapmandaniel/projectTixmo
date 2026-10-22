import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { buyerRecoveryRequest, clearResetIntent, getResetIntent } from '../lib/buyerRecovery';
import { getAccessToken, getSessionGeneration } from '../lib/session';
import { DashboardButton, DashboardPage, DashboardPageHeader, DashboardSurface, DashboardTextInput } from '../components/dashboard/DashboardPrimitives';

export default function BuyerPasswordResetPage({ onPasswordReset = () => {} }) {
    const [token, setToken] = useState(getResetIntent);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [changed, setChanged] = useState(false);
    const alive = useRef(false);
    const pending = useRef(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const submit = async event => {
        event.preventDefault(); if (pending.current) return;
        setError(''); setNotice('');
        if (token && password !== confirm) { setError('Passwords must match.'); return; }
        if (token && new TextEncoder().encode(password).length > 72) { setError('Choose a shorter password.'); return; }
        pending.current = true; setBusy(true);
        const session = { generation: getSessionGeneration(), accessToken: getAccessToken() };
        try {
            await buyerRecoveryRequest(token ? 'reset-password' : 'forgot-password', token ? { token, password } : { email: email.trim().toLowerCase() });
            if (!alive.current) return;
            if (token) {
                clearResetIntent(); setToken(''); setPassword(''); setConfirm(''); setChanged(true);
                onPasswordReset(session);
                setNotice('Password changed. Sign in with your new password. If another account is signed in, sign out first.');
            } else setNotice('If this email belongs to an eligible buyer, a reset link will be sent. Check your email.');
        } catch (failure) { if (alive.current) setError(failure.message); }
        finally { pending.current = false; if (alive.current) setBusy(false); }
    };
    return <main className="min-h-screen bg-dashboard-shell px-4 py-8 text-zinc-100 sm:px-8">
        <DashboardPage className="mx-auto max-w-xl">
            <DashboardPageHeader isDark title="Recover buyer access" description="Choose a new password without purchasing your tickets again. This recovery flow is for buyer accounts." />
            <DashboardSurface isDark className="p-5">
                {notice ? <p role="status">{notice}</p> : null}
                {error ? <p role="alert">{error}</p> : null}
                {!changed ? <form onSubmit={submit} className="space-y-4">
                    {token ? <>
                        <p>Use at least 8 characters, with uppercase and lowercase letters, a number and a special character.</p>
                        <DashboardTextInput isDark type="password" aria-label="New password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} required />
                        <DashboardTextInput isDark type="password" aria-label="Confirm new password" autoComplete="new-password" minLength={8} maxLength={72} value={confirm} onChange={event => setConfirm(event.target.value)} required />
                    </> : <>
                        <p>Enter the email address used to buy your tickets. Missing or expired link? Request another here. Wait one minute before requesting another link; use the latest email.</p>
                        <DashboardTextInput isDark type="email" aria-label="Buyer email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />
                    </>}
                    <DashboardButton isDark type="submit" disabled={busy}>{busy ? 'Please wait…' : token ? 'Change password' : 'Email reset link'}</DashboardButton>
                </form> : null}
                {token ? <DashboardButton isDark variant="secondary" disabled={busy} onClick={() => { clearResetIntent(); setToken(''); setPassword(''); setConfirm(''); setError(''); }}>Request another link</DashboardButton> : null}
                <Link to="/wallet">Return to wallet sign-in</Link>
            </DashboardSurface>
        </DashboardPage>
    </main>;
}
