import React, { useState, useEffect } from 'react';
import { User, Shield, Lock, CheckCircle2, X, ArrowLeft, ArrowRight, Save } from 'lucide-react';
import InputField from '../components/InputField';
import api from '../lib/api';

const TeamMemberWizard = ({ onClose, onSuccess, isDark }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        title: '',
        role: 'TEAM_MEMBER',
        permissions: {
            manageEvents: false,
            viewAnalytics: false,
            manageTickets: false,
            scanTickets: false,
            manageTeam: false
        }
    });

    const steps = [
        { number: 1, title: "Basic Info", icon: User },
        { number: 2, title: "Role & Access", icon: Shield },
        { number: 3, title: "Review", icon: CheckCircle2 }
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePermissionChange = (key) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [key]: !prev.permissions[key]
            }
        }));
    };

    const validateStep = (currentStep) => {
        setError('');
        if (currentStep === 1) {
            if (!formData.firstName || !formData.lastName || !formData.email) {
                setError('Please fill in all required fields');
                return false;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                setError('Please enter a valid email address');
                return false;
            }
        }
        return true;
    };

    const nextStep = () => {
        if (validateStep(step)) {
            if (step === 2 && formData.role !== 'TEAM_MEMBER') {
                // Skip permissions if not Team Member (Review is step 3)
                // Actually step 3 is review, so we just go to 3
                setStep(3);
            } else {
                setStep(prev => prev + 1);
            }
        }
    };

    const prevStep = () => {
        setStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            await api.post('/users', formData);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to create team member');
        } finally {
            setLoading(false);
        }
    };

    const roles = [
        {
            id: 'OWNER',
            label: 'Owner',
            description: 'Full control over the entire organization and billing.',
            icon: Lock
        },
        {
            id: 'ADMIN',
            label: 'Admin',
            description: 'Can manage events, team members, and view all data.',
            icon: Shield
        },
        {
            id: 'TEAM_MEMBER',
            label: 'Team Member',
            description: 'Custom access based on specific permissions.',
            icon: User
        }
    ];

    const permissionOptions = [
        { key: 'manageEvents', label: 'Manage Events', description: 'Create and edit events' },
        { key: 'viewAnalytics', label: 'View Analytics', description: 'See sales and traffic data' },
        { key: 'manageTickets', label: 'Manage Tickets', description: 'Create and edit ticket types' },
        { key: 'scanTickets', label: 'Scan Tickets', description: 'Perform check-ins' },
        { key: 'manageTeam', label: 'Manage Team', description: 'Add and remove team members' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-2xl h-[90vh] flex flex-col rounded-2xl shadow-2xl scale-100 transition-all ${isDark ? 'bg-[#1e1e1e] border border-[#333]' : 'bg-white'}`}>

                {/* Header */}
                <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                    <div>
                        <h2 className={`text-xl font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Add Team Member</h2>
                        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Grant access to your organization</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                        <X size={20} />
                    </button>
                </div>

                {/* Steps Progress */}
                <div className={`px-8 py-4 bg-opacity-50 ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between relative">
                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 ${isDark ? 'bg-[#333]' : 'bg-gray-200'} -z-10`} />
                        {steps.map((s) => {
                            const Icon = s.icon;
                            const isActive = step >= s.number;
                            const isCurrent = step === s.number;
                            return (
                                <div key={s.number} className="flex flex-col items-center bg-inherit px-2 z-10 space-y-2">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isActive
                                            ? (isDark ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200')
                                            : (isDark ? 'bg-[#333] text-gray-500' : 'bg-white border-2 border-gray-200 text-gray-400')
                                        }`}>
                                        <Icon size={18} />
                                    </div>
                                    <span className={`text-xs font-medium transition-colors ${isCurrent
                                            ? (isDark ? 'text-indigo-400' : 'text-indigo-600')
                                            : (isActive ? (isDark ? 'text-gray-300' : 'text-gray-600') : (isDark ? 'text-gray-600' : 'text-gray-400'))
                                        }`}>{s.title}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm flex items-center animate-shake">
                            <X size={16} className="mr-2" />
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in-up">
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="First Name"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    placeholder="Jane"
                                    isDark={isDark}
                                    required
                                />
                                <InputField
                                    label="Last Name"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    placeholder="Doe"
                                    isDark={isDark}
                                    required
                                />
                            </div>
                            <InputField
                                label="Email Address"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="jane@example.com"
                                isDark={isDark}
                                required
                            />
                            <InputField
                                label="Job Title"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                placeholder="e.g. Marketing Manager"
                                isDark={isDark}
                            />
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {roles.map((role) => (
                                    <div
                                        key={role.id}
                                        onClick={() => setFormData(prev => ({ ...prev, role: role.id }))}
                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${formData.role === role.id
                                                ? (isDark ? 'border-indigo-500 bg-indigo-500/10' : 'border-indigo-600 bg-indigo-50')
                                                : (isDark ? 'border-[#333] hover:border-gray-600' : 'border-gray-200 hover:border-gray-300')
                                            }`}
                                    >
                                        <div className={`mb-3 w-8 h-8 rounded-lg flex items-center justify-center ${formData.role === role.id
                                                ? (isDark ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white')
                                                : (isDark ? 'bg-[#333] text-gray-400' : 'bg-gray-100 text-gray-500')
                                            }`}>
                                            <role.icon size={16} />
                                        </div>
                                        <h3 className={`font-medium mb-1 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{role.label}</h3>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{role.description}</p>
                                    </div>
                                ))}
                            </div>

                            {formData.role === 'TEAM_MEMBER' && (
                                <div className={`p-6 rounded-xl border ${isDark ? 'border-[#333] bg-[#252525]' : 'border-gray-200 bg-gray-50'} animate-fade-in`}>
                                    <h4 className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Access Permissions</h4>
                                    <div className="space-y-3">
                                        {permissionOptions.map((perm) => (
                                            <label key={perm.key} className="flex items-start space-x-3 cursor-pointer group">
                                                <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.permissions[perm.key]
                                                        ? 'bg-indigo-600 border-indigo-600'
                                                        : (isDark ? 'border-[#444] group-hover:border-gray-400' : 'border-gray-300 bg-white group-hover:border-gray-400')
                                                    }`}>
                                                    {formData.permissions[perm.key] && <CheckCircle2 size={12} className="text-white" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={formData.permissions[perm.key]}
                                                    onChange={() => handlePermissionChange(perm.key)}
                                                />
                                                <div>
                                                    <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{perm.label}</p>
                                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{perm.description}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className={`p-6 rounded-xl flex items-center space-x-4 ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-100'}`}>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white'}`}>
                                    <User size={24} />
                                </div>
                                <div>
                                    <h3 className={`text-lg font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{formData.firstName} {formData.lastName}</h3>
                                    <p className={`text-sm ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{formData.title || formData.role.replace('_', ' ')} • {formData.email}</p>
                                </div>
                            </div>

                            <div className={`p-6 rounded-xl border ${isDark ? 'border-[#333]' : 'border-gray-200'}`}>
                                <h4 className={`text-sm font-medium mb-3 uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Access Summary</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Role</span>
                                        <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{formData.role.replace('_', ' ')}</span>
                                    </div>
                                    {formData.role === 'TEAM_MEMBER' && (
                                        <div className="pt-2 mt-2 border-t border-dashed border-gray-700/50">
                                            <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Permissions:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(formData.permissions)
                                                    .filter(([_, enabled]) => enabled)
                                                    .map(([key]) => (
                                                        <span key={key} className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-[#333] text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                                            {permissionOptions.find(p => p.key === key)?.label}
                                                        </span>
                                                    ))}
                                                {Object.values(formData.permissions).every(v => !v) && (
                                                    <span className={`text-xs italic ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No specific permissions selected</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className={`text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                An invitation email will be sent to <strong>{formData.email}</strong> to set their password.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer buttons */}
                <div className={`p-6 border-t flex justify-between ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                    <button
                        onClick={step === 1 ? onClose : prevStep}
                        className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDark
                                ? 'text-gray-400 hover:text-white hover:bg-[#333]'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        disabled={loading}
                    >
                        {step === 1 ? 'Cancel' : 'Back'}
                    </button>
                    <button
                        onClick={step === 3 ? handleSubmit : nextStep}
                        disabled={loading}
                        className={`px-8 py-2.5 rounded-xl text-sm font-medium flex items-center shadow-lg transition-all ${isDark
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                            }`}
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                Processing...
                            </>
                        ) : (
                            <>
                                {step === 3 ? 'Send Invite' : 'Continue'}
                                {step !== 3 && <ArrowRight size={16} className="ml-2" />}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeamMemberWizard;
