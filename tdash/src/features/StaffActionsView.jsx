import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { DashboardPage, DashboardPageHeader } from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';

const StaffActionsView = ({ isDark = true, user }) => {
    const theme = getDashboardTheme(isDark);
    const allowed = ['OWNER', 'ADMIN'].includes(user?.role);
    const [items, setItems] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!allowed) return undefined;
        let cancelled = false;
        api.get('/staff-actions', { params: { page: 1, limit: 50 } })
            .then((response) => {
                if (cancelled) return;
                const body = response.data;
                setItems(Array.isArray(body?.data) ? body.data : []);
            })
            .catch(() => {
                if (!cancelled) setError('Unable to load staff actions');
            });
        return () => { cancelled = true; };
    }, [allowed]);

    return (
        <DashboardPage>
            <DashboardPageHeader
                isDark={isDark}
                eyebrow="Operations"
                title="Staff actions"
                description="Scanner revokes and event edits, cancellations, and status changes."
            />
            {!allowed ? <p className={theme.textSecondary}>Only an owner or admin can read this log.</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            {allowed && !error && !items.length ? <p className={theme.textSecondary}>No staff actions yet.</p> : null}
            {items.length ? (
                <ul className="space-y-3">
                    {items.map((item) => (
                        <li key={item.id} className={`rounded border p-3 ${theme.panel}`}>
                            <p>{item.action} · {item.subjectType} {item.subjectId}</p>
                            <p className={theme.textSecondary}>{item.reason}</p>
                            <p className={theme.textSecondary}>Actor {item.actorId} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</p>
                        </li>
                    ))}
                </ul>
            ) : null}
        </DashboardPage>
    );
};

export default StaffActionsView;
