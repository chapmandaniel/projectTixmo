// Parser-blocking same-origin bootstrap: no token storage, request, logging or rendering.
if (window.location.pathname === '/reset-password') {
    const values = new URLSearchParams(window.location.hash.slice(1));
    window.__TIXMO_BUYER_RESET_INTENT__ = values.getAll('token').length === 1 && /^[a-f0-9]{64}$/.test(values.get('token')) ? values.get('token') : '';
    window.history.replaceState(window.history.state, '', window.location.pathname);
}
