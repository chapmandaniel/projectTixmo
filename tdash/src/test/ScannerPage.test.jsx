import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScannerPage from '../pages/ScannerPage';
import { SCANNER_KEY_STORAGE, ticketQR } from '../lib/scannerClient';

const key = 'sk_scanner_synthetic';
const ticketId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const qr = `TICKET:${ticketId}:TIX-ABC123:${eventId}`;
const reply = data => ({ ok: true, json: async () => ({ success: true, data }) });
const authenticated = { id: 'scanner', name: 'North gate', status: 'ACTIVE' };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function connect() {
    fireEvent.change(screen.getByLabelText('Scanner API key'), { target: { value: key } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect scanner' }));
    await screen.findByText('North gate');
}
function enter(value = qr) { fireEvent.change(screen.getByLabelText('Ticket QR or barcode'), { target: { value } }); }
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check ticket for entry' }));

const httpError = (status, body) => ({ ok: false, status, json: async () => body });
beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(authenticated)));
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4);
    delete window.BarcodeDetector;
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Online scanner', () => {
    it.each(['TICKET:missing:barcode:event', `TICKET:${ticketId}::${eventId}`, `${qr}:extra`, 'https://other.example/ticket'])('rejects malformed ticket QR %s', value => {
        expect(() => ticketQR(value)).toThrow();
    });
    it('uses only scanner auth and shows nested denial despite a successful HTTP envelope', async () => {
        const storage = vi.spyOn(Storage.prototype, 'setItem');
        render(<ScannerPage />); await connect();
        fetch.mockResolvedValueOnce(reply({ success: false, reason: 'Ticket already used' }));
        enter(); check();
        expect(await screen.findByText('Not admitted')).toBeInTheDocument();
        expect(screen.getByText('Ticket already used')).toBeInTheDocument();
        const [authUrl, authOptions] = fetch.mock.calls[0];
        expect(authUrl).toBe('/api/v1/scanners/auth');
        expect(authOptions.headers.Authorization).toBeUndefined();
        expect(JSON.parse(authOptions.body)).toEqual({ apiKey: key });
        const [scanUrl, options] = fetch.mock.calls[1];
        expect(scanUrl).toBe('/api/v1/scanners/scan');
        expect(options.headers.Authorization).toBe(`Bearer ${key}`);
        expect(options.credentials).toBe('omit');
        expect(JSON.parse(options.body)).toEqual({ qrData: qr, scanType: 'ENTRY' });
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBe(key);
        expect(storage).toHaveBeenCalledWith(SCANNER_KEY_STORAGE, key);
        expect(storage.mock.calls.some(([name]) => name === 'access_token')).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: 'Forget scanner' }));
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBeNull();
        expect(screen.getByLabelText('Scanner API key')).toHaveValue('');
        expect(screen.queryByText('Ticket already used')).not.toBeInTheDocument();
    });
    it('requires valid QR before request and constructs raw barcode entry from explicit IDs', async () => {
        render(<ScannerPage />); await connect(); enter('bad payload'); check();
        expect(await screen.findByText(/Use a complete ticket QR/)).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledTimes(1);
        enter('TIX-ABC123');
        fireEvent.change(screen.getByLabelText('Ticket ID (barcode entry only)'), { target: { value: ticketId } });
        fireEvent.change(screen.getByLabelText('Event ID (barcode entry only)'), { target: { value: eventId } });
        fetch.mockResolvedValueOnce(reply({ success: true })); check();
        expect(await screen.findByText('Admitted')).toBeInTheDocument();
        expect(JSON.parse(fetch.mock.calls[1][1].body).qrData).toBe(qr);
    });
    it('joins rapid submissions into one active admission request and uses its actual response', async () => {
        render(<ScannerPage />); await connect(); enter();
        const pending = deferred(); fetch.mockReturnValueOnce(pending.promise);
        const form = screen.getByRole('button', { name: 'Check ticket for entry' }).closest('form');
        fireEvent.submit(form); fireEvent.submit(form);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(screen.queryByText('Admitted')).not.toBeInTheDocument();
        await act(async () => { pending.resolve(reply({ success: true })); });
        expect(await screen.findByText('Admitted')).toBeInTheDocument();
    });
    it('does not infer admission from missing data or a failed network and permits explicit recovery', async () => {
        render(<ScannerPage />); await connect(); enter();
        fetch.mockRejectedValueOnce(new Error('private request details')); check();
        expect(await screen.findByText(/No confirmed result. Check the ticket/)).toBeInTheDocument();
        expect(screen.queryByText('private request details')).not.toBeInTheDocument();
        fetch.mockResolvedValueOnce(reply({ ticket: {} })); check();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Check ticket for entry' })).not.toBeDisabled());
        expect(screen.queryByText('Admitted')).not.toBeInTheDocument();
        fetch.mockResolvedValueOnce(reply({ success: false, reason: 'Event cancelled' })); check();
        expect(await screen.findByText('Event cancelled')).toBeInTheDocument();
    });
    it('does not queue offline scans', async () => {
        render(<ScannerPage />); await connect(); enter();
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); check();
        expect(await screen.findByText(/nothing is saved offline/)).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('offers manual fallback when camera detection is unsupported', async () => {
        render(<ScannerPage />); await connect(); fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
        expect(await screen.findByText(/Camera QR scanning is unavailable/)).toBeInTheDocument();
        expect(screen.getByLabelText('Ticket QR or barcode')).toBeEnabled();
        expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    });
    it('checks QR format support before requesting camera access', async () => {
        class Detector { static getSupportedFormats = vi.fn(async () => ['code_128']); }
        vi.stubGlobal('BarcodeDetector', Detector);
        render(<ScannerPage />); await connect(); fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
        expect(await screen.findByText(/does not support camera QR decoding/)).toBeInTheDocument();
        expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    });
    it('camera admits only the returned QR result then stops all tracks', async () => {
        const stop = vi.fn(), detect = vi.fn(async () => [{ rawValue: qr }, { rawValue: qr }]);
        class Detector { static getSupportedFormats = vi.fn(async () => ['qr_code']); detect = detect; }
        vi.stubGlobal('BarcodeDetector', Detector);
        navigator.mediaDevices.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });
        const { unmount } = render(<ScannerPage />); await connect();
        fetch.mockResolvedValueOnce(reply({ success: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
        expect(await screen.findByText('Admitted')).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledTimes(2); expect(detect).toHaveBeenCalledTimes(1); expect(stop).toHaveBeenCalledTimes(1);
        unmount(); expect(stop).toHaveBeenCalledTimes(1);
    });
    it('stops a stream that arrives after unmount and does not submit its QR', async () => {
        class Detector { detect = vi.fn(); }
        vi.stubGlobal('BarcodeDetector', Detector);
        const media = deferred(), stop = vi.fn(); navigator.mediaDevices.getUserMedia.mockReturnValue(media.promise);
        const { unmount } = render(<ScannerPage />); await connect();
        fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); unmount();
        await act(async () => { media.resolve({ getTracks: () => [{ stop }] }); });
        expect(stop).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('recovers from camera permission rejection without disabling manual entry', async () => {
        class Detector { detect = vi.fn(); }
        vi.stubGlobal('BarcodeDetector', Detector);
        navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));
        render(<ScannerPage />); await connect(); fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
        expect(await screen.findByText(/Camera could not start/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start camera' })).toBeEnabled();
        expect(screen.getByLabelText('Ticket QR or barcode')).toBeEnabled();
    });
    it('ignores a detector result arriving after the operator stops the camera', async () => {
        const found = deferred(), stop = vi.fn(), detect = vi.fn(() => found.promise);
        class Detector { detect = detect; }
        vi.stubGlobal('BarcodeDetector', Detector);
        navigator.mediaDevices.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });
        render(<ScannerPage />); await connect();
        fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
        await waitFor(() => expect(detect).toHaveBeenCalled());
        fireEvent.click(screen.getByRole('button', { name: 'Stop camera' }));
        await act(async () => { found.resolve([{ rawValue: qr }]); });
        expect(fetch).toHaveBeenCalledTimes(1); expect(stop).toHaveBeenCalledTimes(1);
    });
    it('manual admission stops the camera and suppresses its pending detector result', async () => {
        const found = deferred(), stop = vi.fn(), detect = vi.fn(() => found.promise), response = deferred();
        class Detector { detect = detect; }
        vi.stubGlobal('BarcodeDetector', Detector);
        navigator.mediaDevices.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });
        render(<ScannerPage />); await connect(); enter();
        fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
        await waitFor(() => expect(detect).toHaveBeenCalled());
        fetch.mockReturnValueOnce(response.promise); check();
        await act(async () => { found.resolve([{ rawValue: qr }]); });
        expect(fetch).toHaveBeenCalledTimes(2); expect(stop).toHaveBeenCalledTimes(1);
        await act(async () => { response.resolve(reply({ success: true })); });
        expect(await screen.findByText('Admitted')).toBeInTheDocument();
    });
    it('stops camera tracks resolving after stop and keeps manual entry available', async () => {
        class Detector { detect = vi.fn(); }
        vi.stubGlobal('BarcodeDetector', Detector);
        const media = deferred(), stop = vi.fn(); navigator.mediaDevices.getUserMedia.mockReturnValue(media.promise);
        render(<ScannerPage />); await connect();
        fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
        fireEvent.click(screen.getByRole('button', { name: 'Stop camera' }));
        await act(async () => { media.resolve({ getTracks: () => [{ stop }] }); });
        expect(stop).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText('Ticket QR or barcode')).toBeEnabled();
    });
    it('ignores stale admission after ending and reconnecting a scanner session', async () => {
        render(<ScannerPage />); await connect(); enter();
        const old = deferred(); fetch.mockReturnValueOnce(old.promise); check();
        const oldSignal = fetch.mock.calls[1][1].signal;
        fireEvent.click(screen.getByRole('button', { name: 'Forget scanner' }));
        expect(oldSignal.aborted).toBe(true);
        await connect();
        await act(async () => { old.resolve(reply({ success: true })); });
        expect(screen.queryByText('Admitted')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Check ticket for entry' })).toBeEnabled();
    });
    it('clears an in-flight authentication and ignores its stale response', async () => {
        render(<ScannerPage />);
        const old = deferred(); fetch.mockReturnValueOnce(old.promise);
        fireEvent.change(screen.getByLabelText('Scanner API key'), { target: { value: key } });
        fireEvent.click(screen.getByRole('button', { name: 'Connect scanner' }));
        fireEvent.click(screen.getByRole('button', { name: 'Forget scanner' }));
        expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
        await act(async () => { old.resolve(reply(authenticated)); });
        expect(screen.queryByText('North gate')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Scanner API key')).toHaveValue('');
    });

    it.each([
        ['Ticket QR or barcode', `TICKET:${eventId}:TIX-OTHER:${ticketId}`],
        ['Ticket ID (barcode entry only)', eventId],
        ['Event ID (barcode entry only)', ticketId],
    ])('clears the previous admission when %s changes without submitting another ticket', async (label, value) => {
        render(<ScannerPage />); await connect(); enter();
        fetch.mockResolvedValueOnce(reply({ success: true })); check();
        expect(await screen.findByText('Admitted')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(label), { target: { value } });
        expect(screen.queryByText('Admitted')).not.toBeInTheDocument();
        expect(screen.queryByText('Not admitted')).not.toBeInTheDocument();
        expect(fetch).toHaveBeenCalledTimes(2);
    });
    it('manual field focus stops pending optical detection before any admission', async () => {
        const found = deferred(), stop = vi.fn(), detect = vi.fn(() => found.promise);
        class Detector { detect = detect; }
        vi.stubGlobal('BarcodeDetector', Detector);
        navigator.mediaDevices.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });
        render(<ScannerPage />); await connect();
        fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
        await waitFor(() => expect(detect).toHaveBeenCalled());
        fireEvent.focus(screen.getByLabelText('Ticket QR or barcode'));
        fireEvent.change(screen.getByLabelText('Ticket QR or barcode'), { target: { value: qr } });
        await act(async () => { found.resolve([{ rawValue: qr }]); });
        expect(stop).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Admitted')).not.toBeInTheDocument();
    });

    it('restores a stored scanner key after reload and removes it with Forget scanner', async () => {
        const { unmount } = render(<ScannerPage />);
        await connect();
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBe(key);
        unmount();
        render(<ScannerPage />);
        expect(await screen.findByText('North gate')).toBeInTheDocument();
        expect(screen.queryByLabelText('Scanner API key')).not.toBeInTheDocument();
        const restored = fetch.mock.calls.filter(([url]) => url === '/api/v1/scanners/auth').at(-1);
        expect(JSON.parse(restored[1].body)).toEqual({ apiKey: key });
        fireEvent.click(screen.getByRole('button', { name: 'Forget scanner' }));
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBeNull();
        expect(screen.getByLabelText('Scanner API key')).toHaveValue('');
        expect(screen.getByText(/Scanner removed from this device/)).toBeInTheDocument();
    });

    it('clears a stored key when auth says the scanner was revoked', async () => {
        localStorage.setItem(SCANNER_KEY_STORAGE, key);
        fetch.mockResolvedValueOnce(httpError(403, { success: false, message: 'Scanner is revoked' }));
        render(<ScannerPage />);
        expect(await screen.findByText('This scanner was revoked, enter a new key.')).toBeInTheDocument();
        expect(screen.queryByText('Invalid key.')).not.toBeInTheDocument();
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBeNull();
        expect(screen.getByLabelText('Scanner API key')).toBeInTheDocument();
        expect(screen.queryByText('North gate')).not.toBeInTheDocument();
    });

    it('clears a stored key when auth says the key is invalid', async () => {
        localStorage.setItem(SCANNER_KEY_STORAGE, key);
        fetch.mockResolvedValueOnce(httpError(401, { success: false, message: 'Invalid API key' }));
        render(<ScannerPage />);
        expect(await screen.findByText('Invalid key.')).toBeInTheDocument();
        expect(screen.queryByText(/this scanner was revoked/i)).not.toBeInTheDocument();
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBeNull();
        expect(screen.getByLabelText('Scanner API key')).toBeInTheDocument();
    });

    it('keeps a stored key when the saved scanner cannot be reached', async () => {
        localStorage.setItem(SCANNER_KEY_STORAGE, key);
        fetch.mockRejectedValueOnce(new Error('offline'));
        render(<ScannerPage />);
        expect(await screen.findByText(/Saved scanner could not be confirmed/)).toBeInTheDocument();
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBe(key);
        expect(screen.queryByText('offline')).not.toBeInTheDocument();
        fetch.mockResolvedValueOnce(reply(authenticated));
        fireEvent.click(screen.getByRole('button', { name: 'Reconnect saved scanner' }));
        expect(await screen.findByText('North gate')).toBeInTheDocument();
    });

    it('shows a different-event result from the current 403 body without dropping the scanner', async () => {
        render(<ScannerPage />); await connect(); enter();
        fetch.mockResolvedValueOnce(httpError(403, { success: false, message: 'Scanner is not assigned to this event' }));
        check();
        expect(await screen.findByText('Not admitted')).toBeInTheDocument();
        expect(screen.getByText('Ticket is for a different event')).toBeInTheDocument();
        expect(screen.queryByText(/Scanner key rejected or scanner unavailable/)).not.toBeInTheDocument();
        expect(screen.getByText('North gate')).toBeInTheDocument();
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBe(key);
    });

    it('includes the event name when the wrong-event body provides one', async () => {
        render(<ScannerPage />); await connect(); enter();
        fetch.mockResolvedValueOnce(httpError(403, {
            success: false,
            message: 'Scanner is not assigned to this event',
            errors: { code: 'WRONG_EVENT', eventName: 'Harbor Night' },
        }));
        check();
        expect(await screen.findByText('Ticket is for a different event: Harbor Night')).toBeInTheDocument();
        expect(screen.queryByText(/Scanner key rejected or scanner unavailable/)).not.toBeInTheDocument();
    });

    it('shows a dispute void from a scan reason code and falls back when that code is absent', async () => {
        render(<ScannerPage />); await connect(); enter();
        fetch.mockResolvedValueOnce(reply({ success: false, reasonCode: 'DISPUTED', reason: 'Ticket voided' }));
        check();
        expect(await screen.findByText('VOID: disputed, see gate lead')).toBeInTheDocument();
        expect(screen.queryByText('Ticket voided')).not.toBeInTheDocument();
        fetch.mockResolvedValueOnce(reply({ success: false, reason: 'Ticket has been cancelled' }));
        check();
        expect(await screen.findByText('Ticket has been cancelled')).toBeInTheDocument();
        expect(screen.queryByText('VOID: disputed, see gate lead')).not.toBeInTheDocument();
        fetch.mockResolvedValueOnce(httpError(400, { success: false, message: 'Ticket voided', errors: { reasonCode: 'CHARGEBACK' } }));
        check();
        expect(await screen.findByText('VOID: disputed, see gate lead')).toBeInTheDocument();
        expect(screen.queryByText(/Scanner key rejected or scanner unavailable/)).not.toBeInTheDocument();
    });

    it('shows Already used for a prior scan and for the 409 race', async () => {
        render(<ScannerPage />); await connect(); enter();
        fetch.mockResolvedValueOnce(reply({ success: false, reason: 'Ticket has already been used' }));
        check();
        expect(await screen.findByText('Already used')).toBeInTheDocument();
        expect(screen.queryByText('Ticket has already been used')).not.toBeInTheDocument();
        fetch.mockResolvedValueOnce(httpError(409, { success: false, message: 'Ticket has already been used' }));
        check();
        expect(await screen.findByText('Already used')).toBeInTheDocument();
        expect(screen.queryByText(/No confirmed result from the server/)).not.toBeInTheDocument();
        expect(screen.getByText('North gate')).toBeInTheDocument();
    });

    it('keeps the generic scanner message for an inactive scanner', async () => {
        render(<ScannerPage />); await connect(); enter();
        fetch.mockResolvedValueOnce(httpError(403, { success: false, message: 'Scanner is not active' }));
        check();
        expect(await screen.findByText('Scanner key rejected or scanner unavailable. Check its assignment and active status.')).toBeInTheDocument();
        expect(screen.queryByText(/Ticket is for a different event/)).not.toBeInTheDocument();
        expect(screen.queryByText(/this scanner was revoked/i)).not.toBeInTheDocument();
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBe(key);
        expect(screen.getByText('North gate')).toBeInTheDocument();
    });

    it('drops the saved key when a later scan says the scanner key is invalid', async () => {
        render(<ScannerPage />); await connect(); enter();
        fetch.mockResolvedValueOnce(httpError(401, { success: false, message: 'Invalid API key' }));
        check();
        expect(await screen.findByText('Invalid key.')).toBeInTheDocument();
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBeNull();
        expect(screen.queryByText('North gate')).not.toBeInTheDocument();
    });

    it('drops the saved key when a later scan says the scanner was revoked', async () => {
        render(<ScannerPage />); await connect(); enter();
        fetch.mockResolvedValueOnce(httpError(403, { success: false, message: 'Scanner is revoked' }));
        check();
        expect(await screen.findByText('This scanner was revoked, enter a new key.')).toBeInTheDocument();
        expect(localStorage.getItem(SCANNER_KEY_STORAGE)).toBeNull();
        expect(screen.queryByText('North gate')).not.toBeInTheDocument();
        expect(screen.queryByText(/Ticket is for a different event/)).not.toBeInTheDocument();
    });

});
