import React, { useState, useEffect } from 'react';
import {
    X, Save, Loader, Layout, Calendar, MapPin, Image as ImageIcon, Ticket,
    ChevronRight, ArrowLeft, CheckCircle2, Globe, Clock, Smartphone, Monitor, AlertCircle
} from 'lucide-react';
import InputField from '../components/InputField';
import TicketBuilder from '../components/TicketBuilder';
import { MOCK_VENUES } from '../data/mockData';
import api from '../lib/api';

/**
 * Tixmo Studio - Unified Event Creator
 * Replaces the old EventWizard with a modern, split-screen interface.
 */
const EventStudio = ({ onClose, onSuccess, isDark, user, initialData = null }) => {
    const [loading, setLoading] = useState(false);
    const [activeSection, setActiveSection] = useState('basics'); // basics, logistics, tickets, media
    const [previewMode, setPreviewMode] = useState('mobile'); // mobile, desktop

    // Unified State
    const [eventData, setEventData] = useState({
        title: '',
        hashtag: '',
        category: 'Music',
        description: '',
        startDateTime: '',
        endDateTime: '',
        venueId: '',
        capacity: '', // Will be calculated from tickets if > 0
        imageUrl: '',
        tags: '',
        status: 'DRAFT'
    });

    const [tickets, setTickets] = useState([]);
    const [venues, setVenues] = useState([]);
    const [notification, setNotification] = useState(null); // { type: 'success'|'error', message: '' }

    // Fetch Venues
    useEffect(() => {
        const loadVenues = async () => {
            try {
                const res = await api.get('/venues?limit=100');
                // Handle different response structures: { data: [...] } vs { data: { venues: [...] } }
                const payload = res.data.data || res.data;
                const venueList = Array.isArray(payload) ? payload : (payload.venues || []);
                setVenues(venueList);
            } catch (err) {
                console.error("Failed to load venues", err);
                setVenues([]); // Fallback to empty array to prevent map errors
            }
        };
        loadVenues();
    }, []);

    // Initialize Data
    useEffect(() => {
        if (initialData) {
            setEventData({
                title: initialData.title || initialData.name || '',
                hashtag: initialData.metadata?.hashtag || '',
                category: initialData.category || 'Music',
                description: initialData.description || '',
                startDateTime: (initialData.startDateTime || initialData.startDatetime) ? new Date(initialData.startDateTime || initialData.startDatetime).toISOString().slice(0, 16) : '',
                endDateTime: (initialData.endDateTime || initialData.endDatetime) ? new Date(initialData.endDateTime || initialData.endDatetime).toISOString().slice(0, 16) : '',
                venueId: initialData.venueId || '',
                capacity: initialData.capacity || '',
                imageUrl: initialData.imageUrl || '',
                tags: initialData.tags ? initialData.tags.join(', ') : '',
                status: initialData.status || 'DRAFT'
            });
            // TODO: Fetch existing tickets for this event if editing
            if (initialData.id) {
                fetchTickets(initialData.id);
            }
        }
    }, [initialData]);

    const fetchTickets = async (eventId) => {
        try {
            const res = await api.get(`/ticket-types?eventId=${eventId}`);
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            // TODO: Fetch tiers for each ticket type if needed
            // For now assuming basic tickets, or need to expand API to return tiers?
            // The getPublicEventBySlug returns tiers, but listTicketTypes might not deeply.
            // Let's assume we might need to fetch tiers individually or the list endpoint is updated.
            // For this MVP, we'll basic map.
            setTickets(data.map(t => ({
                ...t,
                tiers: t.tiers || []
            })));
        } catch (err) {
            console.error("Failed to load tickets", err);
        }
    };

    // Calculate total capacity from tickets if any exist
    useEffect(() => {
        if (tickets.length > 0) {
            const totalCap = tickets.reduce((sum, t) => sum + parseInt(t.quantity || 0, 10), 0);
            setEventData(prev => ({ ...prev, capacity: totalCap }));
        }
    }, [tickets]);

    const handleSave = async (publish = false) => {
        // Validation for Publish
        if (publish) {
            const missing = [];
            if (!eventData.title) missing.push('Title');
            if (!eventData.venueId) missing.push('Venue');
            if (!eventData.startDateTime) missing.push('Start Date');
            if (!eventData.endDateTime) missing.push('End Date');
            if (!tickets.length || eventData.capacity <= 0) missing.push('Tickets/Capacity');

            if (missing.length > 0) {
                setNotification({
                    type: 'error',
                    message: `Cannot Publish. Missing: ${missing.join(', ')}`
                });
                setTimeout(() => setNotification(null), 5000);
                return;
            }
        }

        setLoading(true);
        try {
            // 1. Create/Update Event
            const payload = {
                title: eventData.title,
                name: eventData.title,
                description: eventData.description,
                organizationId: user.organizationId,
                venueId: eventData.venueId || undefined,
                startDateTime: eventData.startDateTime ? new Date(eventData.startDateTime).toISOString() : undefined,
                endDateTime: eventData.endDateTime ? new Date(eventData.endDateTime).toISOString() : undefined,
                status: publish ? 'PUBLISHED' : (eventData.status || 'DRAFT'),
                capacity: parseInt(eventData.capacity, 10) || 0,
                imageUrl: eventData.imageUrl || undefined,
                category: eventData.category,
                metadata: { hashtag: eventData.hashtag },
                tags: eventData.tags ? eventData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
            };

            let eventId = initialData?.id;

            if (initialData) {
                await api.put(`/events/${initialData.id}`, payload);
            } else {
                const res = await api.post('/events', payload);
                eventId = res.data.data?.id || res.data.id;
            }

            // 2. Handle Tickets (Create/Update)
            if (eventId && tickets.length > 0) {
                await Promise.all(tickets.map(async (t) => {
                    const ticketPayload = {
                        eventId,
                        name: t.name,
                        price: parseFloat(t.price),
                        quantity: parseInt(t.quantity, 10),
                        status: t.status || 'ACTIVE'
                    };

                    let ticketTypeId = t.id;
                    let isNewTicket = !t.id || t.id.toString().length < 10 || t.id.toString().startsWith('temp_');

                    if (!isNewTicket) {
                        await api.put(`/ticket-types/${t.id}`, ticketPayload);
                    } else {
                        const res = await api.post('/ticket-types', ticketPayload);
                        // Access the created ticket ID from the response properly
                        // The API returns { data: { id: ... }, message: ... } or just the object
                        const createdTicket = res.data.data || res.data;
                        ticketTypeId = createdTicket.id;
                    }

                    // 3. Handle Tiers for this Ticket Type
                    if (t.tiers && t.tiers.length > 0 && ticketTypeId) {
                        // Deleting old tiers not implemented for simplicity, just adding new ones or updating
                        await Promise.all(t.tiers.map(tier => {
                            const tierPayload = {
                                ticketTypeId, // Use the real ID
                                name: tier.name,
                                price: parseFloat(tier.price),
                                quantityLimit: tier.quantityLimit ? parseInt(tier.quantityLimit, 10) : null,
                                startsAt: tier.startsAt ? new Date(tier.startsAt).toISOString() : null,
                                endsAt: tier.endsAt ? new Date(tier.endsAt).toISOString() : null,
                                sortOrder: tier.sortOrder || 0
                            };

                            if (tier.id && !tier.id.toString().startsWith('temp_')) {
                                return api.put(`/ticket-tiers/${tier.id}`, tierPayload);
                            } else {
                                return api.post('/ticket-tiers', tierPayload);
                            }
                        }));
                    }
                }));
            }

            setNotification({
                type: 'success',
                message: publish ? "Event Published Successfully!" : "Draft Saved Successfully."
            });
            setTimeout(() => {
                setNotification(null);
                if (onSuccess) onSuccess();
                onClose();
            }, 1500);

        } catch (err) {
            console.error("Save failed", err);
            const msg = err.response?.data?.message || err.message || "Unknown error";
            setNotification({
                type: 'error',
                message: `Save Failed: ${msg}`
            });
            setTimeout(() => setNotification(null), 5000);
        } finally {
            setLoading(false);
        }
    };

    // Helper to get formatted date for preview
    const formatDate = (isoString) => {
        if (!isoString) return 'Date TBA';
        return new Date(isoString).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    };

    const getVenueName = () => {
        if (!eventData.venueId) return 'Venue To Be Announced';
        const v = venues.find(v => v.id === eventData.venueId);
        return v ? v.name : 'Unknown Venue';
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col animate-fade-in-up">

            {/* Top Bar */}
            <div className={`h-16 border-b flex items-center justify-between px-6 ${isDark ? 'border-[#333] bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center space-x-4">
                    <button onClick={onClose} className={`p-2 rounded-full hover:bg-gray-800 transition-colors ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        <X size={20} />
                    </button>
                    <div className="h-6 w-px bg-gray-700 mx-2"></div>
                    <span className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {initialData ? 'Edit Event' : 'New Event'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs border ${eventData.status === 'PUBLISHED'
                        ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                        : 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
                        }`}>
                        {eventData.status}
                    </span>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => handleSave(false)}
                        disabled={loading}
                        className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${isDark
                            ? 'border-[#333] text-gray-300 hover:bg-[#333]'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        Save Draft
                    </button>
                    <button
                        onClick={() => handleSave(true)}
                        disabled={loading}
                        className={`px-6 py-2 text-sm font-medium rounded-lg text-white shadow-lg transition-all flex items-center ${isDark
                            ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                            }`}
                    >
                        {loading ? <Loader size={16} className="animate-spin mr-2" /> : <Globe size={16} className="mr-2" />}
                        Publish Event
                    </button>
                </div>
            </div>

            {/* Main Canvas */}
            <div className="flex-1 flex overflow-hidden">

                {/* Notification Banner */}
                {notification && (
                    <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-xl flex items-center space-x-3 animate-fade-in-down ${notification.type === 'error'
                        ? 'bg-rose-500 text-white'
                        : 'bg-emerald-500 text-white'
                        }`}>
                        {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                        <span className="font-medium text-sm">{notification.message}</span>
                    </div>
                )}

                <div className={`w-1/2 flex flex-col border-r relative overflow-y-auto custom-scrollbar ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
                    <div className="p-8 pb-32 space-y-10">

                        {/* Section: Basics */}
                        <section id="basics" className="space-y-6 animate-fade-in">
                            <div className="flex items-center space-x-2 text-indigo-500 mb-2">
                                <Layout size={20} />
                                <h3 className="font-semibold uppercase tracking-wider text-xs">Event Basics</h3>
                            </div>

                            <InputField
                                label="Event Title"
                                value={eventData.title}
                                onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                                placeholder="e.g. Neon Nights 2025"
                                isDark={isDark}
                                autoFocus
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="Category"
                                    type="select"
                                    value={eventData.category}
                                    onChange={(e) => setEventData({ ...eventData, category: e.target.value })}
                                    options={[
                                        { value: 'Music', label: 'Music' },
                                        { value: 'Nightlife', label: 'Nightlife' },
                                        { value: 'Theater', label: 'Theater' },
                                        { value: 'Conference', label: 'Conference' }
                                    ]}
                                    isDark={isDark}
                                />
                                <InputField
                                    label="Hashtag"
                                    value={eventData.hashtag}
                                    onChange={(e) => setEventData({ ...eventData, hashtag: e.target.value })}
                                    placeholder="#Event2025"
                                    isDark={isDark}
                                />
                            </div>

                            <InputField
                                label="Description"
                                type="textarea"
                                value={eventData.description}
                                onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                                placeholder="Tell people what makes this event special..."
                                isDark={isDark}
                            />
                        </section>

                        <hr className={`border-t ${isDark ? 'border-[#333]' : 'border-gray-200'}`} />

                        {/* Section: Logistics */}
                        <section id="logistics" className="space-y-6 animate-fade-in">
                            <div className="flex items-center space-x-2 text-emerald-500 mb-2">
                                <Calendar size={20} />
                                <h3 className="font-semibold uppercase tracking-wider text-xs">Time & Place</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <InputField
                                    label="Start"
                                    type="datetime-local"
                                    value={eventData.startDateTime}
                                    onChange={(e) => setEventData({ ...eventData, startDateTime: e.target.value })}
                                    isDark={isDark}
                                />
                                <InputField
                                    label="End"
                                    type="datetime-local"
                                    value={eventData.endDateTime}
                                    onChange={(e) => setEventData({ ...eventData, endDateTime: e.target.value })}
                                    isDark={isDark}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className={`text-xs font-medium ml-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Venue</label>
                                <select
                                    value={eventData.venueId}
                                    onChange={(e) => setEventData({ ...eventData, venueId: e.target.value })}
                                    className={`w-full px-4 py-3 rounded-xl outline-none border transition-all ${isDark
                                        ? 'bg-[#1e1e1e] border-[#333] text-white focus:border-indigo-500'
                                        : 'bg-white border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                                        }`}
                                >
                                    <option value="">Select a Venue</option>
                                    {venues.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.name} ({v.address?.city || 'Unknown City'})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-indigo-500 cursor-pointer hover:underline text-right">
                                    + Create New Venue
                                </p>
                            </div>
                        </section>

                        <hr className={`border-t ${isDark ? 'border-[#333]' : 'border-gray-200'}`} />

                        {/* Section: Tickets */}
                        <section id="tickets" className="space-y-6 animate-fade-in">
                            <div className="flex items-center space-x-2 text-rose-500 mb-2">
                                <Ticket size={20} />
                                <h3 className="font-semibold uppercase tracking-wider text-xs">Tickets & Capacity</h3>
                            </div>

                            <TicketBuilder
                                tickets={tickets}
                                onChange={setTickets}
                                isDark={isDark}
                            />

                            <div className={`p-4 rounded-lg flex items-center justify-between ${isDark ? 'bg-[#252525]' : 'bg-white border'}`}>
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Event Capacity</span>
                                <span className={`text-lg font-mono font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {eventData.capacity || 0}
                                </span>
                            </div>
                        </section>

                        <hr className={`border-t ${isDark ? 'border-[#333]' : 'border-gray-200'}`} />

                        {/* Section: Media */}
                        <section id="media" className="space-y-6 animate-fade-in">
                            <div className="flex items-center space-x-2 text-amber-500 mb-2">
                                <ImageIcon size={20} />
                                <h3 className="font-semibold uppercase tracking-wider text-xs">Media & SEO</h3>
                            </div>

                            <InputField
                                label="Cover Image URL"
                                value={eventData.imageUrl}
                                onChange={(e) => setEventData({ ...eventData, imageUrl: e.target.value })}
                                placeholder="https://..."
                                isDark={isDark}
                            />
                            <InputField
                                label="Search Tags"
                                value={eventData.tags}
                                onChange={(e) => setEventData({ ...eventData, tags: e.target.value })}
                                placeholder="concert, jazz, summer..."
                                isDark={isDark}
                            />
                        </section>

                    </div>
                </div>

                {/* Right Panel: Preview */}
                <div className={`flex-1 relative flex flex-col ${isDark ? 'bg-[#121212]' : 'bg-gray-100'}`}>

                    {/* Preview Toolbar */}
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2 p-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
                        <button
                            onClick={() => setPreviewMode('mobile')}
                            className={`p-2 rounded-full transition-all ${previewMode === 'mobile' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Smartphone size={16} />
                        </button>
                        <button
                            onClick={() => setPreviewMode('desktop')}
                            className={`p-2 rounded-full transition-all ${previewMode === 'desktop' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Monitor size={16} />
                        </button>
                    </div>

                    {/* Preview Container */}
                    <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
                        <div className={`transition-all duration-500 ease-spring ${previewMode === 'mobile'
                            ? 'w-[375px] h-[700px] rounded-[3rem] border-[8px] border-gray-800 shadow-2xl overflow-hidden relative bg-white'
                            : 'w-full max-w-4xl h-auto aspect-video rounded-xl shadow-2xl overflow-hidden bg-white border border-gray-800'
                            }`}>
                            {/* LIVE PREVIEW CONTENT */}
                            <div className="h-full overflow-y-auto bg-white text-black">
                                <div className="relative h-48 bg-gray-200">
                                    {eventData.imageUrl ? (
                                        <img src={eventData.imageUrl} alt="cover" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                                            <ImageIcon size={48} />
                                        </div>
                                    )}
                                    <div className="absolute top-4 left-4 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-medium">
                                        {eventData.category}
                                    </div>
                                </div>
                                <div className="p-6">
                                    <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
                                        {eventData.title || 'Untitled Event'}
                                    </h1>
                                    <p className="text-sm text-indigo-600 font-medium mb-4">{eventData.hashtag}</p>

                                    <div className="space-y-4 mb-6">
                                        <div className="flex items-start space-x-3 text-gray-600">
                                            <Calendar size={18} className="mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{formatDate(eventData.startDateTime)}</p>
                                                <p className="text-xs">to {formatDate(eventData.endDateTime)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start space-x-3 text-gray-600">
                                            <MapPin size={18} className="mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{getVenueName()}</p>
                                                <p className="text-xs">Get Directions</p>
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="my-4 border-gray-100" />

                                    <div className="prose prose-sm text-gray-600 mb-8">
                                        <p>{eventData.description || 'Event description will appear here...'}</p>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="font-bold text-gray-900 text-sm">Select Tickets</h3>
                                        {tickets.length === 0 ? (
                                            <div className="p-4 border border-dashed rounded-lg text-center text-xs text-gray-400">
                                                No tickets available yet
                                            </div>
                                        ) : (
                                            tickets.map((t, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:border-gray-300 transition-colors">
                                                    <div>
                                                        <p className="font-medium text-sm text-gray-900">{t.name}</p>
                                                        <p className="text-xs text-gray-500">{t.quantity} remaining</p>
                                                    </div>
                                                    <span className="font-semibold text-gray-900">${t.price}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="mt-8">
                                        <button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-lg hover:bg-indigo-700 transition-colors">
                                            Get Tickets
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default EventStudio;
