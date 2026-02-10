import React, { useState } from 'react';
import { X, Copy, Check, AlertCircle, QrCode } from 'lucide-react';
import api from '../lib/api';

const RegisterScannerModal = ({ onClose, onSuccess, isDark }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [step, setStep] = useState('FORM'); // FORM or SUCCESS
    const [scannerName, setScannerName] = useState('');
    const [deviceId, setDeviceId] = useState('');
    const [createdScanner, setCreatedScanner] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            // Need organizationId - usually from context or selected org
            // For now, we rely on the backend to handle it or user context
            // But the schema requires 'organizationId'.
            // In a real app, we'd pick the org.
            // Let's assume the user has a default organization or we fetch it.
            // Actually, `registerScanner` in routes says required: name, organizationId.
            // The API might infer it if we don't send it, OR we need to fetch the current user's org.
            // Let's look at `auth.getCurrentUser()` in App.jsx.
            // Let's simpler: The backend `registerScanner` controller uses `req.body`.
            // The backend `validation.ts` likely enforces it.
            // For this UI, let's try sending just name and see if backend infers from User's org (common pattern)
            // or if we need to mock it/fetch it. 
            // Audit found `User` model has a `organizationId`.
            // Let's try to fetch user profile or get from local storage if available.
            // Assuming for now the backend might handle it or we pass a hardcoded/fetched ID.
            // Wait, looking at routes.ts line 28: organizationId is required in body.
            // I'll grab it from the user object if passed as prop, or try to get it from auth.
            // For this implementation, I'll attempt to use the `user.organizationId` if available.

            // Note: In a real "admin" dashboard, you might select which org you are creating it for.
            // For "Promoter" dashboard, it's their own org.
            let organizationId;
            try {
                const user = JSON.parse(localStorage.getItem('tixmo_user') || '{}');
                organizationId = user.organizationId;
            } catch (e) {
                console.error('Failed to parse user from local storage', e);
            }

            if (!organizationId) {
                throw new Error("Organization ID not found. Please log in again.");
            }

            const payload = {
                name: scannerName,
                deviceId: deviceId || undefined,
                organizationId: organizationId
                // eventId: optional
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

    const inputClass = `w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark
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
                        {step === 'FORM' ? 'Register New Scanner' : 'Scanner Registered!'}
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
                                <div className={`p-4 rounded-lg flex items-center space-x-2 ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                                    <AlertCircle size={20} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div>
                                <label className={labelClass}>Scanner Name</label>
                                <input
                                    type="text"
                                    value={scannerName}
                                    onChange={(e) => setScannerName(e.target.value)}
                                    placeholder="e.g. Main Entrance 1"
                                    required
                                    className={inputClass}
                                    autoFocus
                                />
                            </div>

                            <div>
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
                            </div>

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
                                            <span>Generate Key</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'}`}>
                                <div className="flex justify-center mb-2">
                                    <div className={`p-2 rounded-full ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                                        <Check size={24} />
                                    </div>
                                </div>
                                <p className="font-medium">Scanner successfully registered</p>
                            </div>

                            <div>
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
                            </div>

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
