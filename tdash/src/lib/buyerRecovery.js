import { getApiBaseUrl } from './runtimeConfig';
let resetIntent = typeof window === 'undefined' ? '' : window.__TIXMO_BUYER_RESET_INTENT__ || '';
if (typeof window !== 'undefined') delete window.__TIXMO_BUYER_RESET_INTENT__;
export const getResetIntent = () => resetIntent;
export const clearResetIntent = () => { resetIntent = ''; };
// Entry fallback before React mounts; ordinary external email uses the parser-blocking bootstrap.
export const captureResetIntent = () => {
    if (window.location.pathname !== '/reset-password' || !window.location.hash) return;
    const values = new URLSearchParams(window.location.hash.slice(1));
    resetIntent = values.getAll('token').length === 1 && /^[a-f0-9]{64}$/.test(values.get('token')) ? values.get('token') : '';
    window.history.replaceState(window.history.state, '', window.location.pathname);
};
export const buyerRecoveryRequest = async (action, body) => {
    if (!['forgot-password', 'reset-password'].includes(action)) throw new Error('Invalid recovery action.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response, payload;
    try {
        response = await fetch(`${getApiBaseUrl()}/auth/${action}`, {
            method: 'POST', credentials: 'omit', redirect: 'error', signal: controller.signal,
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        payload = await response.json();
    } catch { throw new Error(action === 'reset-password' ? 'Could not confirm the result. Try signing in with the new password, or request a new link.' : 'Could not confirm the request. Try again later.'); }
    finally { clearTimeout(timeout); }
    if (response.status === 429 || response.status === 503) throw new Error('Password recovery is busy. Try again later.');
    if (!response.ok || payload?.success !== true) throw new Error(action === 'reset-password'
        ? 'This link is invalid or expired, or the password does not meet the requirements. Request a new link if needed.'
        : 'Unable to request a reset link. Try again later.');
};
