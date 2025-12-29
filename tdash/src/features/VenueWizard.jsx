import React, { useState } from 'react';
import { MapPin, CheckCircle2, X, ArrowLeft, ArrowRight, Save, Building2, Users } from 'lucide-react';
import InputField from '../components/InputField';
import api from '../lib/api';

const VenueWizard = ({ onClose, onSuccess, isDark, user }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        capacity: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'USA',
        timezone: 'America/Los_Angeles', // Default
        description: ''
    });

    const steps = [
        { id: 1, label: 'Details', icon: Building2 },
        { id: 2, label: 'Address', icon: MapPin },
        { id: 3, label: 'Review', icon: CheckCircle2 },
    ];

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            if (!user?.organizationId) {
                throw new Error('User organization not found.');
            }

            const payload = {
                name: formData.name,
                organizationId: user.organizationId,
                capacity: parseInt(formData.capacity, 10),
                address: {
                    street: formData.street,
                    city: formData.city,
                    state: formData.state,
                    postalCode: formData.postalCode,
                    country: formData.country
                },
                timezone: formData.timezone,
                description: formData.description
            };

            await api.post('/venues', payload);

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.message || 'Failed to create venue');
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => {
        // Basic validation
        if (step === 1 && (!formData.name || !formData.capacity)) {
            setError('Please fill in all required fields');
            return;
        }
        if (step === 2 && (!formData.street || !formData.city || !formData.state || !formData.postalCode)) {
            setError('Please fill in all address fields');
            return;
        }
        setError('');
        setStep(step + 1);
    };

    const prevStep = () => {
        setStep(step - 1);
        setError('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] ${isDark ? 'bg-[#1a1a1a] text-white' : 'bg-white text-gray-900'}`}>
                {/* Header */}
                <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'border-[#333]' : 'border-gray-100'}`}>
                    <div>
                        <h2 className="text-xl font-semibold">Create New Venue</h2>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Add a new location for your events</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333]' : 'hover:bg-gray-100'}`}>
                        <X size={20} />
                    </button>
                </div>

                {/* Steps */}
                <div className={`px-6 py-4 border-b ${isDark ? 'border-[#333] bg-[#252525]' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex justify-between relative">
                        {/* Progress Bar Background */}
                        <div className={`absolute top-1/2 left-0 w-full h-0.5 -translate-y-1/2 ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`} />
                        {/* Active Progress */}
                        <div
                            className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-indigo-500 transition-all duration-300"
                            style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                        />

                        {steps.map((s) => {
                            const isActive = s.id === step;
                            const isCompleted = s.id < step;

                            return (
                                <div key={s.id} className="relative flex flex-col items-center z-10">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 mb-2
                                        ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110' :
                                            isCompleted ? 'bg-indigo-600 text-white' :
                                                isDark ? 'bg-[#333] text-gray-400 border-2 border-[#1a1a1a]' : 'bg-white text-gray-400 border-2 border-gray-100 shadow-sm'}`}
                                    >
                                        <s.icon size={14} />
                                    </div>
                                    <span className={`text-xs font-medium transition-colors ${isActive ? (isDark ? 'text-white' : 'text-gray-900') :
                                            isCompleted ? 'text-indigo-500' :
                                                isDark ? 'text-gray-500' : 'text-gray-400'
                                        }`}>
                                        {s.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center animate-fade-in">
                            <X size={16} className="mr-2" />
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <InputField
                                label="Venue Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. The Grand Hall"
                                isDark={isDark}
                            />
                            <InputField
                                label="Capacity"
                                type="number"
                                value={formData.capacity}
                                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                placeholder="Max number of guests"
                                isDark={isDark}
                            />
                            <InputField
                                label="Description (Optional)"
                                type="textarea"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Details about this venue..."
                                isDark={isDark}
                            />
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-fade-in">
                            <InputField
                                label="Street Address"
                                value={formData.street}
                                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                placeholder="123 Main St"
                                isDark={isDark}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="City"
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    placeholder="New York"
                                    isDark={isDark}
                                />
                                <InputField
                                    label="State"
                                    value={formData.state}
                                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                    placeholder="NY"
                                    isDark={isDark}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="Postal Code"
                                    value={formData.postalCode}
                                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                                    placeholder="10001"
                                    isDark={isDark}
                                />
                                <InputField
                                    label="Country"
                                    value={formData.country}
                                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                    isDark={isDark}
                                />
                            </div>
                            <InputField
                                label="Timezone"
                                value={formData.timezone}
                                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                placeholder="America/New_York"
                                isDark={isDark}
                            />
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Review Details</h3>
                            <div className={`p-6 rounded-xl space-y-4 ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Venue Name</p>
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{formData.name}</p>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Capacity</p>
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{formData.capacity}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Address</p>
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {formData.street}, {formData.city}, {formData.state} {formData.postalCode}, {formData.country}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`p-6 border-t flex justify-between items-center ${isDark ? 'border-[#333] bg-[#1a1a1a]' : 'border-gray-100 bg-white'}`}>
                    {step > 1 ? (
                        <button
                            onClick={prevStep}
                            className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center
                                ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#252525]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                        >
                            <ArrowLeft size={16} className="mr-2" />
                            Back
                        </button>
                    ) : (
                        <div />
                    )}

                    <button
                        onClick={step === 3 ? handleSubmit : nextStep}
                        disabled={loading}
                        className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center shadow-lg shadow-indigo-500/20
                            ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
                            bg-indigo-600 hover:bg-indigo-500 text-white`}
                    >
                        {loading ? (
                            <span className="flex items-center">Creating...</span>
                        ) : step === 3 ? (
                            <>
                                <Save size={16} className="mr-2" />
                                Create Venue
                            </>
                        ) : (
                            <>
                                Next Step
                                <ArrowRight size={16} className="ml-2" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VenueWizard;
