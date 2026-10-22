import { getApiBaseUrl } from './runtimeConfig';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const barcode = /^[A-Za-z0-9_-]{1,256}$/;

export function ticketQR(input, ticketId = '', eventId = '') {
    const value = input.trim();
    const parts = value.startsWith('TICKET:') ? value.split(':') : ['TICKET', ticketId.trim(), value, eventId.trim()];
    if (value.length > 1024 || parts.length !== 4 || parts[0] !== 'TICKET' || !uuid.test(parts[1]) || !barcode.test(parts[2]) || !uuid.test(parts[3])) {
        throw new Error('Use a complete ticket QR, or enter the barcode with its ticket ID and event ID.');
    }
    return parts.join(':');
}

// Deliberately separate from the dashboard JWT client: no storage/interceptors.
export async function scannerRequest(endpoint, key, body, signal) {
    const response = await fetch(`${getApiBaseUrl()}/scanners/${endpoint}`, {
        method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/json', ...(endpoint === 'scan' ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify(endpoint === 'auth' ? { apiKey: key } : body),
    });
    if (!response.ok) {
        const error = new Error(response.status === 401 || response.status === 403
            ? 'Scanner key rejected or scanner unavailable. Check its assignment and active status.'
            : 'No confirmed result from the server. Check the ticket before trying again.');
        error.status = response.status;
        throw error;
    }
    const payload = await response.json();
    if (payload?.success !== true || !payload.data) throw new Error('No confirmed result from the server. Check the ticket before trying again.');
    return payload.data;
}
