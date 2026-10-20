import React, { useEffect, useState } from 'react';
import { auth } from '../lib/auth';
import { DashboardButton, DashboardSurface, DashboardTextInput } from '../components/dashboard/DashboardPrimitives';

const AcceptInvitationView = ({ onAccepted }) => {
    const [token, setToken] = useState(() => window.location.hash.slice(1));
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const consumeLink = () => {
            const incoming = window.location.hash.slice(1);
            if (incoming) {
                setToken(incoming);
                setError('');
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        };
        consumeLink();
        window.addEventListener('hashchange', consumeLink);
        return () => window.removeEventListener('hashchange', consumeLink);
    }, []);

    const submit = async (event) => {
        event.preventDefault();
        if (password !== confirmation) {
            setError('Passwords must match.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            onAccepted(await auth.acceptInvitation(token, password));
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to accept this invitation. Request a new link from your team.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-dashboard-shell px-5 py-8 text-dashboard-text">
            <DashboardSurface isDark className="w-full max-w-md p-6 sm:p-8">
                <h1 className="text-3xl font-light">Accept invitation</h1>
                <p className="mt-3 text-sm text-dashboard-muted">Choose your password to join the team. Invitation links expire after 48 hours and work once.</p>
                {!/^[a-f0-9]{64}$/.test(token) ? (
                    <p role="alert" className="mt-6 text-sm">Open the complete invitation link from your email.</p>
                ) : (
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <label className="block text-sm">Password
                            <DashboardTextInput isDark type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
                        </label>
                        <p className="text-xs text-dashboard-muted">Use at least 8 characters, with uppercase, lowercase, a number and a special character.</p>
                        <label className="block text-sm">Confirm password
                            <DashboardTextInput isDark type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
                        </label>
                        {error ? <p role="alert" className="text-sm">{error}</p> : null}
                        <DashboardButton isDark type="submit" disabled={submitting}>{submitting ? 'Joining…' : 'Join team'}</DashboardButton>
                    </form>
                )}
            </DashboardSurface>
        </main>
    );
};

export default AcceptInvitationView;
