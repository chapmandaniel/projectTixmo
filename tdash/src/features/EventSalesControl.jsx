import React, { useRef, useState } from 'react';
import { api } from '../lib/api';
import { commitSalesPause } from '../lib/salesPause';
import { DashboardButton, DashboardSurface, DashboardTextInput } from '../components/dashboard/DashboardPrimitives';

export default function EventSalesControl({ event, user, isDark }) {
    const [current, setCurrent] = useState(event);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const request = useRef(null);
    const inFlight = useRef(false);
    if (!['OWNER', 'ADMIN', 'MANAGER', 'PROMOTER'].includes(user?.role) || event.deletedAt) return null;
    const submit = async (paused) => {
        if (inFlight.current || (!request.current && !reason.trim())) return;
        inFlight.current = true;
        setBusy(true); setMessage('');
        try {
            request.current ||= { paused, reason: reason.trim(), requestId: crypto.randomUUID() };
            const refreshed = await commitSalesPause(api, event.id, request.current);
            setCurrent(refreshed);
            request.current = null;
            setReason('');
            setMessage(`Request acknowledged. Current sales state: ${refreshed.salesPaused ? 'paused' : 'not paused'}.`);
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || 'Sales control failed. Retry the same request.');
        } finally { inFlight.current = false; setBusy(false); }
    };
    return <DashboardSurface isDark={isDark} className="mb-4 space-y-3 p-4">
        <h3>New ticket sales: {current.salesPaused ? 'paused' : 'not paused'}</h3>
        <p>Existing orders and tickets keep their existing rules. Resume does not change event status or inventory. Resume requires incident review.</p>
        <label htmlFor="sales-control-reason">Operational reason (no credentials)</label>
        <DashboardTextInput id="sales-control-reason" isDark={isDark} maxLength={1000} value={reason}
            disabled={busy || Boolean(request.current)} onChange={(e) => setReason(e.target.value)} />
        {request.current ? <DashboardButton isDark={isDark} disabled={busy} onClick={() => submit(request.current.paused)}>Retry same request</DashboardButton> : <>
            <DashboardButton isDark={isDark} disabled={busy || !reason.trim() || current.salesPaused !== false} onClick={() => submit(true)}>Pause new sales</DashboardButton>
            <DashboardButton isDark={isDark} disabled={busy || !reason.trim() || current.salesPaused !== true} onClick={() => submit(false)}>Resume new sales</DashboardButton>
        </>}
        <p role="status">{message}</p>
    </DashboardSurface>;
}
