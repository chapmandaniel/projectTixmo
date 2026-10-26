import { getApiBaseUrl } from './runtimeConfig';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const barcode = /^[A-Za-z0-9_-]{1,256}$/;
const scannerKeyPattern = /^sk_scanner_[A-Za-z0-9_-]{1,256}$/;

export const SCANNER_KEY_STORAGE = 'tixmo_scanner_api_key';

const ASSIGNMENT_MESSAGE = 'Scanner is not assigned to this event';
const ALREADY_USED_REASON = 'Ticket has already been used';
export const SCANNER_UNAVAILABLE = 'Scanner key rejected or scanner unavailable. Check its assignment and active status.';
const ALREADY_USED = 'Already used';

const DISPUTE_CODES = new Set([
    'DISPUTED',
    'DISPUTE',
    'VOID_DISPUTED',
    'DISPUTE_VOID',
    'VOIDED_DISPUTE',
    'VOIDED_BY_DISPUTE',
    'CHARGEBACK',
    'CHARGE_DISPUTE',
    'DISPUTED_VOID',
    'VOID_DISPUTE',
]);

const CODE_KEYS = ['reasonCode', 'voidReason', 'code', 'failureCode', 'status'];

export function ticketQR(input, ticketId = '', eventId = '') {
    const value = input.trim();
    const parts = value.startsWith('TICKET:') ? value.split(':') : ['TICKET', ticketId.trim(), value, eventId.trim()];
    if (value.length > 1024 || parts.length !== 4 || parts[0] !== 'TICKET' || !uuid.test(parts[1]) || !barcode.test(parts[2]) || !uuid.test(parts[3])) {
        throw new Error('Use a complete ticket QR, or enter the barcode with its ticket ID and event ID.');
    }
    return parts.join(':');
}

export function readStoredScannerKey() {
    let value = '';
    try {
        value = localStorage.getItem(SCANNER_KEY_STORAGE) || '';
    } catch {
        return '';
    }
    if (!value) return '';
    if (!scannerKeyPattern.test(value)) {
        forgetScannerKey();
        return '';
    }
    return value;
}

export function storeScannerKey(key) {
    localStorage.setItem(SCANNER_KEY_STORAGE, key);
}

export function forgetScannerKey() {
    try {
        localStorage.removeItem(SCANNER_KEY_STORAGE);
    } catch {
        /* storage can be unavailable in a private browser context */
    }
}

function asObject(value) {
    return value && typeof value === 'object' ? value : null;
}

function codeValues(source) {
    const object = asObject(source);
    if (!object) return [];
    return CODE_KEYS.flatMap((key) => (typeof object[key] === 'string' && object[key].trim() ? [object[key].trim()] : []));
}

function payloadCodes(payload) {
    return [
        ...codeValues(payload),
        ...codeValues(payload?.errors),
        ...codeValues(payload?.data),
        ...codeValues(payload?.ticket),
        ...codeValues(payload?.data?.ticket),
    ].map((value) => value.toUpperCase());
}

function textValue(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function wrongEventMessage(payload) {
    const name = [
        payload?.errors?.eventName,
        payload?.errors?.event?.name,
        payload?.data?.eventName,
        payload?.data?.event?.name,
        payload?.data?.ticket?.event?.name,
        payload?.eventName,
        payload?.ticket?.event?.name,
    ].map(textValue).find(Boolean) || (textValue(payload?.message).match(/different event:\s*(.+)$/i)?.[1] || '').trim();
    return name ? `Ticket is for a different event: ${name}` : 'Ticket is for a different event';
}

function isWrongEvent(status, payload) {
    if (status !== 403) return false;
    if (textValue(payload?.message) === ASSIGNMENT_MESSAGE) return true;
    return payloadCodes(payload).includes('WRONG_EVENT');
}

function isAlreadyUsed(status, payload) {
    const message = textValue(payload?.message);
    const reason = textValue(payload?.reason || payload?.data?.reason);
    return message === ALREADY_USED_REASON || reason === ALREADY_USED_REASON || (status === 409 && message === ALREADY_USED_REASON);
}

export function disputeVoidMessage(payload) {
    const codes = payloadCodes(payload);
    const reason = [payload?.reason, payload?.data?.reason, payload?.message].map(textValue).find(Boolean) || '';
    const reasonCode = textValue(payload?.reason || payload?.data?.reason).toUpperCase();
    const voided = codes.some((code) => code === 'VOID' || code === 'VOIDED');
    if (codes.some((code) => DISPUTE_CODES.has(code)) || DISPUTE_CODES.has(reasonCode) || (voided && /disput|chargeback/i.test(reason))) {
        return 'VOID: disputed, see gate lead';
    }
    return '';
}

export function admissionMessage(data) {
    const dispute = disputeVoidMessage(data);
    if (dispute) return dispute;
    const reason = textValue(data?.reason);
    if (reason === ALREADY_USED_REASON) return ALREADY_USED;
    return reason || 'Admission denied';
}

function keyRejected(status, payload) {
    if (status === 401) return true;
    if (status !== 403) return false;
    const message = textValue(payload?.message);
    return /scanner is (not active|revoked|disabled)/i.test(message) || /invalid (scanner )?api key/i.test(message) || /api key required/i.test(message);
}

function scannerFailure(status, message, flags, body) {
    const error = new Error(message);
    error.status = status;
    error.body = body;
    Object.assign(error, flags);
    return error;
}

// Dashboard JWT storage stays out of this client. The page stores only the scanner key.
export async function scannerRequest(endpoint, key, body, signal) {
    const response = await fetch(`${getApiBaseUrl()}/scanners/${endpoint}`, {
        method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/json', ...(endpoint === 'scan' ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify(endpoint === 'auth' ? { apiKey: key } : body),
    });
    if (!response.ok) {
        let payload = {};
        try {
            const parsed = await response.json();
            payload = asObject(parsed) || {};
        } catch {
            payload = {};
        }
        const voided = disputeVoidMessage(payload);
        if (voided) throw scannerFailure(response.status, voided, { voided: true }, payload);
        if (isWrongEvent(response.status, payload)) throw scannerFailure(response.status, wrongEventMessage(payload), { wrongEvent: true }, payload);
        if (isAlreadyUsed(response.status, payload)) throw scannerFailure(response.status, ALREADY_USED, { alreadyUsed: true }, payload);
        if (response.status === 401 || response.status === 403) {
            throw scannerFailure(response.status, SCANNER_UNAVAILABLE, {
                forgetKey: keyRejected(response.status, payload),
            }, payload);
        }
        throw scannerFailure(response.status, 'No confirmed result from the server. Check the ticket before trying again.', {}, payload);
    }
    const payload = await response.json();
    if (payload?.success !== true || !payload.data) throw new Error('No confirmed result from the server. Check the ticket before trying again.');
    return payload.data;
}
