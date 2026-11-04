import React, { useEffect, useState } from 'react';
import { X, Copy, Check, AlertCircle, QrCode } from 'lucide-react';
import api from '../lib/api';

const eventName = (event) => event?.name || event?.title || 'Untitled event';

const RegisterScannerModal = ({ onClose, onSuccess, isDark, scanner = null }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [step, setStep] = useState('FORM'); // FORM or SUCCESS
    const [scannerName, setScannerName] = useState(scanner?.name || '');
    const [deviceId, setDeviceId] = useState(scanner?.deviceId || '');
    const [eventId, setEventId] = useState(scanner?.eventId || '');
    const [events, setEvents] = useState([]);
    const [eventsError, setEventsError] = useState('');
    const [eventsLoading, setEventsLoading] = useState(true);
    const [createdScanner, setCreatedScanner] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let active = true;
        const loadEvents = async () => {
            setEventsLoading(true);
            setEventsError('');
            try {
                const collected = [];
                let page = 1;
                let pages = 1;
                do {
                    const response = await api.get('/events', { params: { page, limit: 100 } });
                    const body = response.data?.data?.events ? response.data.data : (response.data || {});
                    collected.push(...(body.events || []));
                    pages = body.pagination?.pages || 1;
                    page += 1;
                } while (page <= pages && page <= 20);
                if (!active) return;
                const known = collected.filter((event) => event?.id && event.ticketingMode !== 'EXTERNAL');
                if (scanner?.eventId && !known.some((event) => event.id === scanner.eventId)) {
                    known.unshift({ id: scanner.eventId, name: scanner.event?.name || 'Current event' });
                }
                setEvents(known);
            } catch (loadError) {
                if (active) setEventsError(loadError.response?.data?.message || 'Unable to load events.');
            } finally {
                if (active) setEventsLoading(false);
            }
        };
        void loadEvents();
        return () => { active = false; };
    }, [scanner?.id, scanner?.eventId, scanner?.event?.name]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!scanner && !eventId) {
            setError('Choose an event. A new scanner must be bound to one event.');
            return;
        }
        setIsLoading(true);

        try {
            if (scanner) {
                await api.put(`/scanners/${scanner.id}`, { eventId: eventId || null });
                setStep('SUCCESS');
                if (onSuccess) onSuccess();
                return;
            }

            let organizationId;
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                organizationId = user.organizationId;
            } catch (parseError) {
                console.error('Failed to parse user from local storage', parseError);
            }

            if (!organizationId) {
                throw new Error("Organization ID not found. Please log in again.");
            }

            const payload = {
                name: scannerName,
                deviceId: deviceId || undefined,
                organizationId,
                eventId,
            };

            const response = await api.post('/scanners/register', payload);
            setCreatedScanner(response.data.data);
            setStep('SUCCESS');
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.message || 'Failed to register scanner');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (createdScanner?.apiKey) {
            navigator.clipboard.writeText(createdScanner.apiKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const inputClass = `w-full px-4 py-2 rounded-lg border focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${isDark
        ? 'bg-[#252525] border-[#333] text-white'
        : 'bg-white border-gray-300 text-gray-900'
        }`;

    const labelClass = `block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-700'}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-md transform rounded-2xl shadow-2xl transition-all ${isDark ? 'bg-[#1e1e1e] border border-[#2a2a2a]' : 'bg-white'}`}>

                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {step === 'FORM' ? (scanner ? 'Change scanner event' : 'Register New Scanner') : (scanner ? 'Event updated' : 'Scanner Registered!')}
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 'FORM' ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div role="alert" className={`p-4 rounded-lg flex items-center space-x-2 ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                                    <AlertCircle size={20} />
                                    <span>{error}</span>
                                </div>
                            )}

                            {!scanner && <div>
                                <label className={labelClass} htmlFor="scanner-name">Scanner Name</label>
                                <input
                                    id="scanner-name"
                                    type="text"
                                    value={scannerName}
                                    onChange={(e) => setScannerName(e.target.value)}
                                    placeholder="e.g. Main Entrance 1"
                                    required
                                    className={inputClass}
                                    autoFocus
                                />
                            </div>}

                            <div>
                                <label className={labelClass} htmlFor="scanner-event">Event</label>
                                <select
                                    id="scanner-event"
                                    value={eventId}
                                    onChange={(change) => setEventId(change.target.value)}
                                    className={inputClass}
                                    disabled={eventsLoading}
                                    required={!scanner}
                                    aria-invalid={!scanner && !eventId && Boolean(error)}
                                    onInvalid={(invalid) => {
                                        invalid.preventDefault();
                                        if (!scanner) setError('Choose an event. A new scanner must be bound to one event.');
                                    }}
                                >
                                    <option value="">{eventsLoading ? 'Loading events…' : (scanner ? 'Not bound to an event' : 'Choose an event')}</option>
                                    {events.map((event) => (
                                        <option key={event.id} value={event.id}>{eventName(event)}</option>
                                    ))}
                                </select>
                                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {eventsError || (scanner ? 'A bound scanner only admits tickets for this event. Leave this blank to unbind it.' : 'Required. This scanner will only admit tickets for the event you choose.')}
                                </p>
                            </div>

                            {!scanner && <div>
                                <label className={labelClass}>Device ID (Optional)</label>
                                <input
                                    type="text"
                                    value={deviceId}
                                    onChange={(e) => setDeviceId(e.target.value)}
                                    placeholder="e.g. DEVICE-001"
                                    className={inputClass}
                                />
                                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    Identifier implementation specific (e.g. Hardware Serial)
                                </p>
                            </div>}

                            <div className="pt-4 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                        ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-2"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <QrCode size={18} />
                                            <span>{scanner ? 'Save event' : 'Generate Key'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            {scanner && <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {eventId ? `${scanner.name} is bound to ${eventName(events.find((event) => event.id === eventId) || scanner.event)}.` : `${scanner.name} is not bound to an event.`}
                            </p>}
                            <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'}`}>
                                <div className="flex justify-center mb-2">
                                    <div className={`p-2 rounded-full ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                                        <Check size={24} />
                                    </div>
                                </div>
                                <p className="font-medium">{scanner ? 'Scanner event saved' : 'Scanner successfully registered'}</p>
                            </div>

                            {!scanner && <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    API Key (Copy this now, it won't be shown again)
                                </label>
                                <div className={`flex items-center space-x-2 p-3 rounded-lg border ${isDark ? 'bg-[#252525] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                                    <code className={`flex-1 font-mono text-sm break-all ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                        {createdScanner?.apiKey}
                                    </code>
                                    <button
                                        onClick={copyToClipboard}
                                        className={`p-2 rounded-lg transition-colors ${copied
                                            ? 'text-green-500 bg-green-500/10'
                                            : (isDark ? 'text-gray-400 hover:bg-[#333] hover:text-white' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900')
                                            }`}
                                        title="Copy to clipboard"
                                    >
                                        {copied ? <Check size={18} /> : <Copy size={18} />}
                                    </button>
                                </div>
                            </div>}

                            <div className="pt-2">
                                <button
                                    onClick={onClose}
                                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                        ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegisterScannerModal;
