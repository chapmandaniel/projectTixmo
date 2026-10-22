import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { commitSalesPause, isDefinitiveSalesControlFailure, isCurrentSalesControlResult } from '../lib/salesPause';
import { DashboardButton, DashboardSurface, DashboardTextInput } from '../components/dashboard/DashboardPrimitives';

export default function EventSalesControl({ event, user, isDark, onUpdate }) {
    const current = event;
    const latest = useRef({ event, user });
    latest.current = { event, user };
    const mounted = useRef(false);
    const [canDiscard, setCanDiscard] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const request = useRef(null);
    const inFlight = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    useEffect(() => {
        // A newer authoritative snapshot invalidates completion of an older request.
        inFlight.current = false;
        setBusy(false);
        setMessage('');
    }, [event, user]);
    if (!['OWNER', 'ADMIN', 'MANAGER', 'PROMOTER'].includes(user?.role) || event.deletedAt) return null;
    const submit = async (paused) => {
        if (inFlight.current || (!request.current && !reason.trim())) return;
        const captured = latest.current;
        const valid = () => isCurrentSalesControlResult(captured, latest.current, mounted.current);
        inFlight.current = true;
        setBusy(true); setMessage(''); setCanDiscard(false);
        try {
            request.current ||= { paused, reason: reason.trim(), requestId: crypto.randomUUID() };
            const refreshed = await commitSalesPause(api, event.id, request.current);
            if (!valid()) return;
            request.current = null;
            setReason('');
            setMessage(`Request acknowledged. Current sales state: ${refreshed.salesPaused ? 'paused' : 'not paused'}.`);
            onUpdate?.(refreshed);
        } catch (error) {
            if (!valid()) return;
            setCanDiscard(isDefinitiveSalesControlFailure(error));
            setMessage(error.response?.data?.message || error.message || 'Sales control failed. Retry the same request.');
        } finally { if (valid()) { inFlight.current = false; setBusy(false); } }
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
        {canDiscard && !busy ? <DashboardButton isDark={isDark} onClick={() => {
            request.current = null; setCanDiscard(false); setReason(''); setMessage('Request discarded. Enter a new reason to submit a new explicit action.');
        }}>Discard rejected request</DashboardButton> : null}
        <p role="status">{message}</p>
    </DashboardSurface>;
}
