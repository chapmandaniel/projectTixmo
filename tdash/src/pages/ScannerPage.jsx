import React, { useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { DashboardButton, DashboardPage, DashboardPageHeader, DashboardSection, DashboardTextInput } from '../components/dashboard/DashboardPrimitives';
import { scannerRequest, ticketQR } from '../lib/scannerClient';
import { getDashboardTheme } from '../lib/dashboardTheme';

export default function ScannerPage({ isDark = true }) {
    const theme = getDashboardTheme(isDark);
    const [draftKey, setDraftKey] = useState('');
    const [scanner, setScanner] = useState(null);
    const [input, setInput] = useState('');
    const [ticketId, setTicketId] = useState('');
    const [eventId, setEventId] = useState('');
    const [busy, setBusy] = useState(false);
    const [camera, setCamera] = useState(false);
    const [notice, setNotice] = useState('');
    const [result, setResult] = useState(null);
    const key = useRef(''), pending = useRef(false), request = useRef(null);
    const live = useRef(true), session = useRef(0), cameraEpoch = useRef(0);
    const stream = useRef(null), timer = useRef(null), video = useRef(null);

    function stopCamera() {
        cameraEpoch.current++;
        clearTimeout(timer.current);
        stream.current?.getTracks().forEach(track => track.stop());
        stream.current = null;
        if (video.current) video.current.srcObject = null;
        if (live.current) setCamera(false);
    }
    function editTicket(setter, value) {
        stopCamera();
        setResult(null); setNotice(''); setter(value);
    }
    function endSession() {
        session.current++;
        stopCamera(); request.current?.abort(); key.current = ''; pending.current = false;
        setDraftKey(''); setScanner(null); setInput(''); setTicketId(''); setEventId(''); setResult(null); setBusy(false); setNotice('Scanner session ended.');
    }
    useEffect(() => {
        live.current = true;
        return () => { live.current = false; session.current++; stopCamera(); request.current?.abort(); key.current = ''; };
    }, []);

    async function perform(endpoint, value, body) {
        if (pending.current) return;
        if (navigator.onLine === false) { setNotice('No connection. Scanning is paused, and nothing is saved offline. Switch to the hotspot or the spare phone.'); return; }
        pending.current = true; setBusy(true); setNotice(''); setResult(null);
        const generation = session.current;
        const controller = new AbortController(); request.current = controller;
        const deadline = setTimeout(() => controller.abort(), 15000);
        try {
            const data = await scannerRequest(endpoint, value, body, controller.signal);
            if (!live.current || generation !== session.current) return;
            if (endpoint === 'auth') {
                if (typeof data.name !== 'string' || data.status !== 'ACTIVE') throw new Error('Scanner unavailable. Ask an administrator to check its active status.');
                key.current = value; setDraftKey(''); setScanner(data);
            } else {
                if (typeof data.valid !== 'boolean') throw new Error('No confirmed admission result. Check the ticket before trying again.');
                setResult({
                    accepted: data.valid,
                    message: data.valid ? 'Admitted' : (data.reason || 'Admission denied'),
                    ticketTypeName: typeof data.ticketTypeName === 'string' ? data.ticketTypeName : '',
                    holderFirstName: typeof data.holderFirstName === 'string' ? data.holderFirstName : '',
                });
            }
        } catch (error) {
            if (live.current && generation === session.current) setNotice(error.status ? error.message : 'No confirmed result. Check the ticket before retrying. Camera and manual entry remain available.');
        } finally {
            clearTimeout(deadline);
            if (live.current && generation === session.current) { pending.current = false; setBusy(false); request.current = null; }
        }
    }
    function connect(event) {
        event.preventDefault();
        const value = draftKey.trim();
        if (!/^sk_scanner_[A-Za-z0-9_-]{1,256}$/.test(value)) { setNotice('Enter a scanner API key beginning sk_scanner_.'); return; }
        void perform('auth', value);
    }
    async function submit(value = input, optical = false) {
        if (pending.current || !key.current) return;
        stopCamera();
        let qrData;
        try { qrData = ticketQR(value, optical ? '' : ticketId, optical ? '' : eventId); }
        catch (error) { setResult(null); setNotice(error.message); return; }
        await perform('scan', key.current, { qrData, scanType: 'ENTRY' });
    }
    async function startCamera() {
        if (pending.current || camera || !key.current) return;
        stopCamera(); setNotice(''); setResult(null);
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.BarcodeDetector) {
            setNotice('Camera QR scanning is unavailable in this browser. Use manual entry or a supported browser over HTTPS.'); return;
        }
        const generation = cameraEpoch.current;
        setCamera(true);
        try {
            if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
                const formats = await window.BarcodeDetector.getSupportedFormats();
                if (generation !== cameraEpoch.current || !live.current) return;
                if (!formats.includes('qr_code')) { stopCamera(); setNotice('This browser does not support camera QR decoding. Use manual entry.'); return; }
            }
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
            if (!live.current || generation !== cameraEpoch.current) { media.getTracks().forEach(track => track.stop()); return; }
            stream.current = media; video.current.srcObject = media;
            await video.current.play();
            async function detect() {
                if (!live.current || generation !== cameraEpoch.current) return;
                try {
                    if (video.current?.readyState >= 2) {
                        const codes = await detector.detect(video.current);
                        if (generation !== cameraEpoch.current || !live.current) return;
                        const code = codes.find(item => typeof item.rawValue === 'string' && item.rawValue);
                        if (code) { await submit(code.rawValue, true); return; }
                    }
                    timer.current = setTimeout(detect, 150);
                } catch { if (generation === cameraEpoch.current && live.current) { stopCamera(); setNotice('Camera decoding stopped. Try the camera again or use manual entry.'); } }
            }
            if (generation === cameraEpoch.current && live.current) void detect();
        } catch {
            if (generation === cameraEpoch.current && live.current) { stopCamera(); setNotice('Camera could not start. Allow camera access, then try again, or use manual entry.'); }
        }
    }
    return <main className={`min-h-screen p-4 sm:p-8 ${theme.shell}`}>
        <DashboardPage>
            <DashboardPageHeader isDark={isDark} icon={ScanLine} title="Ticket scanner" eyebrow="Online admission" description="Scan one ticket at a time. Internet access and an active scanner key are required." />
            {!scanner ? <DashboardSection isDark={isDark} title="Connect your scanner" description="Your scanner key stays in memory for this session and is cleared when you leave or end the session.">
                <form onSubmit={connect} className="space-y-4">
                    <label htmlFor="scanner-key">Scanner API key</label>
                    <DashboardTextInput isDark={isDark} id="scanner-key" type="password" autoComplete="off" value={draftKey} onChange={event => setDraftKey(event.target.value)} disabled={busy} />
                    <div className="flex flex-wrap gap-3"><DashboardButton isDark={isDark} type="submit" disabled={busy}>Connect scanner</DashboardButton><DashboardButton isDark={isDark} variant="secondary" onClick={endSession}>Clear scanner key</DashboardButton></div>
                </form>
            </DashboardSection> : <>
                <DashboardSection isDark={isDark} title={scanner.name} description="Online entry only. A camera scan pauses for its result; restart it for the next ticket." actions={<DashboardButton isDark={isDark} variant="secondary" onClick={endSession}>End scanner session</DashboardButton>}>
                    <video ref={video} muted playsInline aria-label="Ticket scanner camera" className="w-full max-w-xl rounded-md" />
                    <div className="flex flex-wrap gap-3">
                        <DashboardButton isDark={isDark} onClick={startCamera} disabled={busy || camera}>Start camera</DashboardButton>
                        <DashboardButton isDark={isDark} variant="secondary" onClick={stopCamera}>Stop camera</DashboardButton>
                    </div>
                </DashboardSection>
                <DashboardSection isDark={isDark} title="Manual or hardware entry" description="Paste the full TICKET QR text. For a barcode alone, also enter its ticket ID and event ID.">
                    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
                        <label htmlFor="ticket-input">Ticket QR or barcode</label>
                        <DashboardTextInput isDark={isDark} id="ticket-input" autoComplete="off" value={input} onFocus={stopCamera} onChange={event => editTicket(setInput, event.target.value)} disabled={busy} />
                        <label htmlFor="ticket-id">Ticket ID (barcode entry only)</label>
                        <DashboardTextInput isDark={isDark} id="ticket-id" value={ticketId} onFocus={stopCamera} onChange={event => editTicket(setTicketId, event.target.value)} disabled={busy} />
                        <label htmlFor="event-id">Event ID (barcode entry only)</label>
                        <DashboardTextInput isDark={isDark} id="event-id" value={eventId} onFocus={stopCamera} onChange={event => editTicket(setEventId, event.target.value)} disabled={busy} />
                        <DashboardButton isDark={isDark} type="submit" disabled={busy}>{busy ? 'Checking ticket…' : 'Check ticket for entry'}</DashboardButton>
                    </form>
                </DashboardSection>
            </>}
            <div role="status" aria-live="polite" className="py-4 text-lg">
                {busy ? 'Waiting for the server. Do not admit until a result is shown.' : result ? <><strong>{result.accepted ? 'Admitted' : 'Not admitted'}</strong>{result.ticketTypeName ? <p>{result.ticketTypeName}</p> : null}{result.holderFirstName ? <p>{result.holderFirstName}</p> : null}{!result.accepted && <p>{result.message}</p>}</> : notice}
            </div>
            <p className="text-sm">No offline admission or queued scans. An uncertain network result is not permission to admit.</p>
        </DashboardPage>
    </main>;
}
