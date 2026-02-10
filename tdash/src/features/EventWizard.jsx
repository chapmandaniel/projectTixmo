import React, { useState, useEffect } from 'react';
import { ClipboardList, Clock, MapPin, CheckCircle2, X, ArrowLeft, ArrowRight, Save, CheckSquare, Loader } from 'lucide-react';
import InputField from '../components/InputField';
import { MOCK_VENUES } from '../data/mockData';
import api from '../lib/api';

const EventWizard = ({ onClose, onSuccess, isDark, user, initialData = null }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [venues, setVenues] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        hashtag: '',
        category: 'Music',
        description: '',
        startDateTime: '',
        endDateTime: '',
        venueId: '',
        capacity: '',
        imageUrl: '',
        tags: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                title: initialData.title || initialData.name || '',
                hashtag: initialData.metadata?.hashtag || '',
                category: initialData.metadata?.category || 'Music',
                description: initialData.description || '',
                startDateTime: (initialData.startDateTime || initialData.startDatetime) ? new Date(initialData.startDateTime || initialData.startDatetime).toISOString().slice(0, 16) : '',
                endDateTime: (initialData.endDateTime || initialData.endDatetime) ? new Date(initialData.endDateTime || initialData.endDatetime).toISOString().slice(0, 16) : '',
                venueId: initialData.venueId || '',
                capacity: initialData.capacity ? String(initialData.capacity) : '',
                imageUrl: initialData.imageUrl || '',
                tags: initialData.tags ? initialData.tags.join(', ') : ''
            });
        }
    }, [initialData]);

    useEffect(() => {
        const fetchVenues = async () => {
            try {
                const response = await api.get('/venues');
                if (response.data?.data) {
                    setVenues(response.data.data.venues || response.data.data);
                }
            } catch (err) {
                console.error("Failed to fetch venues", err);
            }
        };
        fetchVenues();
    }, []);

    const steps = [
        { id: 1, label: 'Details', icon: ClipboardList },
        { id: 2, label: 'Timing', icon: Clock },
        { id: 3, label: 'Venue', icon: MapPin },
        { id: 4, label: 'Review', icon: CheckCircle2 },
    ];

    const handleSaveDraft = async () => {
        if (!formData.title) {
            setError('Event title is required to save a draft');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                title: formData.title,
                description: formData.description || '',
                organizationId: user.organizationId,
                venueId: formData.venueId || undefined,
                status: 'DRAFT',
                // Handle optional dates
                startDateTime: formData.startDateTime ? new Date(formData.startDateTime).toISOString() : undefined,
                endDateTime: formData.endDateTime ? new Date(formData.endDateTime).toISOString() : undefined,
                capacity: formData.capacity ? parseInt(formData.capacity, 10) : undefined,
                imageUrl: formData.imageUrl || undefined,
                category: formData.category,
                metadata: {
                    hashtag: formData.hashtag
                }
            };

            if (initialData) {
                await api.put(`/events/${initialData.id}`, payload);
            } else {
                await api.post('/events', payload);
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to save draft');
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        // Basic validation
        if (step === 1 && (!formData.title)) {
            // Relaxed validation: only title is truly mandatory for step 1? 
            // Requirements say "Keep strict for guided flow". 
            // So if they want to proceed to Step 2 (Timing), they should fill Step 1?
            // Actually, if I allow draft, maybe I can relax Step 1 too? 
            // No, let's keep guided flow strict to encourage completion.
            // But the user complained about "wizard did not allow any text entry" previously (unrelated bug).
            if (!formData.title || !formData.category || !formData.hashtag) return;
        }
        if (step === 2 && (!formData.startDateTime || !formData.endDateTime)) return;
        // Step 3 validation (Venue)
        if (step === 3 && (!formData.venueId || !formData.capacity)) return;

        setStep(prev => Math.min(prev + 1, 4));
    };

    const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            console.log("EventWizard Debug: User object:", user);
            console.log("EventWizard Debug: OrganizationId:", user?.organizationId);

            if (!user?.organizationId) {
                throw new Error('User organization not found. Please contact support.');
            }

            const payload = {
                title: formData.title,
                description: formData.description || 'No description provided',
                organizationId: user.organizationId,
                venueId: formData.venueId,
                startDateTime: new Date(formData.startDateTime).toISOString(),
                endDateTime: new Date(formData.endDateTime).toISOString(),
                status: 'DRAFT', // Default to draft
                capacity: parseInt(formData.capacity, 10),
                imageUrl: formData.imageUrl || undefined,
                category: formData.category,
                metadata: {
                    hashtag: formData.hashtag
                },
                tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
            };

            if (initialData) {
                const response = await api.put(`/events/${initialData.id}`, payload);
                if (onSuccess) onSuccess(response.data.data || response.data);
            } else {
                await api.post('/events', payload);
                if (onSuccess) onSuccess();
            }

            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.message || 'Failed to create event');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-3xl rounded-2xl flex flex-col shadow-2xl overflow-hidden ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>

                {/* Header with Stepper */}
                <div className={`p-8 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                    <div className="flex justify-between items-center mb-8">
                        <h2 className={`text-xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{initialData ? 'Edit Event' : 'Create New Event'}</h2>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={handleSaveDraft}
                                disabled={loading}
                                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors flex items-center ${isDark ? 'border-[#333] text-gray-400 hover:text-white hover:border-gray-500' : 'border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}
                            >
                                <Save size={14} className="mr-1.5" />
                                Save Draft & Exit
                            </button>
                            <button onClick={onClose} disabled={loading} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between relative">
                        <div className={`absolute left-0 top-1/2 h-0.5 w-full -z-10 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}></div>
                        {steps.map((s) => {
                            const isActive = s.id === step;
                            const isCompleted = s.id < step;
                            return (
                                <div key={s.id} className="flex flex-col items-center bg-inherit px-2">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-4 ${isActive
                                        ? (isDark ? 'bg-indigo-500 border-[#1e1e1e] text-white' : 'bg-indigo-600 border-white text-white shadow-lg')
                                        : isCompleted
                                            ? (isDark ? 'bg-[#2a2a2a] border-[#1e1e1e] text-indigo-400' : 'bg-indigo-50 border-white text-indigo-600')
                                            : (isDark ? 'bg-[#252525] border-[#1e1e1e] text-gray-600' : 'bg-gray-100 border-white text-gray-400')
                                        }`}>
                                        <s.icon size={18} />
                                    </div>
                                    <span className={`text-xs mt-2 font-medium ${isActive ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (isDark ? 'text-gray-600' : 'text-gray-400')}`}>{s.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* content area with error message */}
                <div className="p-8 min-h-[300px]">
                    {error && (
                        <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex items-center">
                            <span className="mr-2">⚠️</span> {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <InputField
                                label="Event Title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g. Summer Jazz Night 2025"
                                isDark={isDark}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="Hashtag (Required for tracking)"
                                    value={formData.hashtag}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/\s/g, ''); // Remove spaces
                                        if (val && !val.startsWith('#')) val = '#' + val;
                                        setFormData({ ...formData, hashtag: val })
                                    }}
                                    placeholder="#EventName2025"
                                    isDark={isDark}
                                />
                                <InputField
                                    label="Category"
                                    type="select"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    options={[
                                        { value: 'Music', label: 'Music' },
                                        { value: 'Conference', label: 'Conference' },
                                        { value: 'Workshop', label: 'Workshop' },
                                        { value: 'Theater', label: 'Theater' }
                                    ]}
                                    isDark={isDark}
                                />
                            </div>
                            <InputField
                                label="Image URL (Optional)"
                                value={formData.imageUrl}
                                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                placeholder="https://..."
                                isDark={isDark}
                            />
                            <InputField
                                label="Description"
                                type="textarea"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe your event..."
                                isDark={isDark}
                            />
                            <InputField
                                label="Tags (Comma separated)"
                                value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                placeholder="e.g. jazz, summer, outdoor, live music"
                                isDark={isDark}
                            />
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-2 gap-6">
                                <InputField
                                    label="Start Date & Time"
                                    type="datetime-local"
                                    value={formData.startDateTime}
                                    onChange={(e) => setFormData({ ...formData, startDateTime: e.target.value })}
                                    isDark={isDark}
                                />
                                <InputField
                                    label="End Date & Time"
                                    type="datetime-local"
                                    value={formData.endDateTime}
                                    onChange={(e) => setFormData({ ...formData, endDateTime: e.target.value })}
                                    isDark={isDark}
                                />
                            </div>
                            <div className={`p-4 rounded-lg flex items-start space-x-3 ${isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                                <Clock size={20} className="mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium">Timezone Awareness</p>
                                    <p className="text-xs opacity-80 mt-1">Events are displayed in local time. Make sure to adjust for the venue's timezone.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-fade-in">
                            <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Select Venue</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                                {venues.map((venue) => (
                                    <div
                                        key={venue.id}
                                        onClick={() => setFormData({ ...formData, venueId: venue.id, capacity: venue.capacity })}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.venueId === venue.id
                                            ? 'border-indigo-500 bg-indigo-50/10'
                                            : (isDark ? 'border-[#2a2a2a] hover:border-gray-600' : 'border-gray-200 hover:border-gray-300')
                                            }`}
                                    >
                                        <h3 className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{venue.name}</h3>
                                        <div className={`mt-2 text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            <div className="flex items-center">
                                                <MapPin size={14} className="mr-2" />
                                                {venue.address?.city}, {venue.address?.state}
                                            </div>
                                            <div className="flex items-center">
                                                <span className="mr-2">👥</span>
                                                Capacity: {venue.capacity}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <InputField
                                label="Total Capacity"
                                type="number"
                                value={formData.capacity}
                                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                placeholder="Max tickets available"
                                isDark={isDark}
                            />
                            {formData.venueId && (
                                <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                                    <h4 className={`text-xs font-medium uppercase mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Venue Details</h4>
                                    <div className="flex items-center space-x-2">
                                        <MapPin size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {(() => {
                                                const addr = venues.find(v => v.id === formData.venueId)?.address;
                                                return addr && typeof addr === 'object'
                                                    ? `${addr.street}, ${addr.city}, ${addr.state}`
                                                    : addr;
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Review Details</h3>
                            <div className={`p-6 rounded-xl space-y-4 ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Event Title</p>
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{formData.title}</p>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Category</p>
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{formData.category}</p>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Hashtag</p>
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{formData.hashtag}</p>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Start Date</p>
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{new Date(formData.startDateTime).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>End Date</p>
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{new Date(formData.endDateTime).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Venue</p>
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {MOCK_VENUES.find(v => v.id === formData.venueId)?.name}
                                        </p>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Capacity</p>
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{formData.capacity}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={`p-4 rounded-lg flex items-center space-x-3 ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                                <CheckSquare size={20} />
                                <span className="text-sm">{initialData ? 'Ready to save changes.' : 'Ready to create draft event. Tickets can be configured after creation.'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Actions */}
                <div className={`p-6 border-t flex justify-between items-center ${isDark ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'}`}>
                    <button
                        onClick={handleBack}
                        disabled={step === 1 || loading}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center ${step === 1
                            ? (isDark ? 'text-[#333] cursor-not-allowed' : 'text-gray-300 cursor-not-allowed')
                            : (isDark ? 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100')
                            }`}
                    >
                        <ArrowLeft size={16} className="mr-2" />
                        Back
                    </button>

                    {step < 4 ? (
                        <button
                            onClick={handleNext}
                            className={`px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all flex items-center shadow-lg ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'}`}
                        >
                            Next Step
                            <ArrowRight size={16} className="ml-2" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className={`px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all flex items-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30'}`}
                        >
                            {loading ? (
                                <>
                                    <Loader size={16} className="animate-spin mr-2" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save size={16} className="mr-2" />
                                    {initialData ? 'Save Changes' : 'Create Event'}
                                </>
                            )}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default EventWizard;
