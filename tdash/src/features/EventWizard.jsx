import React, { useState } from 'react';
import { ClipboardList, Clock, MapPin, CheckCircle2, X, ArrowLeft, ArrowRight, Save, CheckSquare } from 'lucide-react';
import InputField from '../components/InputField';
import { MOCK_VENUES } from '../data/mockData';

const EventWizard = ({ onClose, isDark }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        title: '',
        hashtag: '', // New field
        category: '',
        description: '',
        startDateTime: '',
        endDateTime: '',
        venueId: '',
        capacity: '',
        imageUrl: ''
    });

    const steps = [
        { id: 1, label: 'Details', icon: ClipboardList },
        { id: 2, label: 'Timing', icon: Clock },
        { id: 3, label: 'Venue', icon: MapPin },
        { id: 4, label: 'Review', icon: CheckCircle2 },
    ];

    const handleNext = () => {
        // Basic validation
        if (step === 1 && (!formData.title || !formData.category || !formData.hashtag)) return;
        if (step === 2 && (!formData.startDateTime || !formData.endDateTime)) return;
        if (step === 3 && (!formData.venueId || !formData.capacity)) return;

        setStep(prev => Math.min(prev + 1, 4));
    };

    const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = () => {
        // In a real app, POST to /events
        console.log("Submitting event:", formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-3xl rounded-2xl flex flex-col shadow-2xl overflow-hidden ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>

                {/* Header with Stepper */}
                <div className={`p-8 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                    <div className="flex justify-between items-center mb-8">
                        <h2 className={`text-xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Create New Event</h2>
                        <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <X size={20} />
                        </button>
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

                {/* Content Area */}
                <div className="p-8 min-h-[300px]">
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
                            <InputField
                                label="Venue"
                                type="select"
                                value={formData.venueId}
                                onChange={(e) => {
                                    const venue = MOCK_VENUES.find(v => v.id === e.target.value);
                                    setFormData({
                                        ...formData,
                                        venueId: e.target.value,
                                        capacity: venue ? venue.capacity : '' // Auto-fill capacity
                                    });
                                }}
                                options={MOCK_VENUES.map(v => ({ value: v.id, label: v.name }))}
                                isDark={isDark}
                            />
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
                                            {MOCK_VENUES.find(v => v.id === formData.venueId)?.address}
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
                                <span className="text-sm">Ready to create draft event. Tickets can be configured after creation.</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Actions */}
                <div className={`p-6 border-t flex justify-between items-center ${isDark ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'}`}>
                    <button
                        onClick={handleBack}
                        disabled={step === 1}
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
                            className={`px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all flex items-center shadow-lg ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30'}`}
                        >
                            <Save size={16} className="mr-2" />
                            Create Event
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default EventWizard;
