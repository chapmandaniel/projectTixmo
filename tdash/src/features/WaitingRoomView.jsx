import React, { useEffect, useState } from 'react';
import { DashboardButton, DashboardSurface } from '../components/dashboard/DashboardPrimitives';

const WaitingRoomView = ({ onRetry, retryAfter = 5 }) => {
    const [remaining, setRemaining] = useState(() => Number.isSafeInteger(retryAfter) && retryAfter > 0 && retryAfter <= 60 ? retryAfter : 5);
    useEffect(() => {
        const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
        return () => window.clearInterval(timer);
    }, []);
    return (
        <div role="dialog" aria-modal="true" aria-labelledby="busy-title" className="fixed inset-0 z-50 flex items-center justify-center bg-dashboard-shell text-zinc-100">
            <DashboardSurface isDark className="max-w-md p-8 text-center">
                <h1 id="busy-title" className="text-3xl mb-4">Checkout is busy</h1>
                <p className="text-dashboard-muted mb-8">Please wait before trying again. Your entered details are retained. No purchase will be retried automatically.</p>
                <DashboardButton isDark autoFocus disabled={remaining > 0} onClick={() => { if (remaining === 0) onRetry(); }}>
                    {remaining > 0 ? `Try again in ${remaining}s` : 'Return to checkout'}
                </DashboardButton>
                <p className="mt-8 text-xs text-dashboard-muted">When ready, return to the form and submit again yourself. This does not reserve a place in a queue.</p>
            </DashboardSurface>
        </div>
    );
};
export default WaitingRoomView;
