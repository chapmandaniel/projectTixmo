import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import api from '../lib/api';

const PromoCodeModal = ({ promoCode, onClose, onSuccess, isDark }) => {
    const isEditMode = !!promoCode;
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        code: '',
        discountType: 'PERCENTAGE',
        discountValue: '',
        maxUses: '',
        maxUsesPerUser: 1,
        minOrderAmount: '',
        validFrom: '',
        validUntil: '',
        status: 'ACTIVE'
    });

    useEffect(() => {
        if (promoCode) {
            setFormData({
                code: promoCode.code,
                discountType: promoCode.discountType,
                discountValue: promoCode.discountValue,
                maxUses: promoCode.maxUses || '',
                maxUsesPerUser: promoCode.maxUsesPerUser || 1,
                minOrderAmount: promoCode.minOrderAmount || '',
                validFrom: promoCode.validFrom ? new Date(promoCode.validFrom).toISOString().slice(0, 16) : '',
                validUntil: promoCode.validUntil ? new Date(promoCode.validUntil).toISOString().slice(0, 16) : '',
                status: promoCode.status
            });
        }
    }, [promoCode]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const payload = {
                ...formData,
                discountValue: parseFloat(formData.discountValue),
                maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
                maxUsesPerUser: formData.maxUsesPerUser ? parseInt(formData.maxUsesPerUser) : null,
                minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
                validFrom: formData.validFrom ? new Date(formData.validFrom).toISOString() : null,
                validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
            };

            if (isEditMode) {
                await api.put(`/promo-codes/${promoCode.id}`, payload);
            } else {
                await api.post('/promo-codes', payload);
            }

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save promo code');
        } finally {
            setIsLoading(false);
        }
    };

    const inputClass = `w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark
        ? 'bg-[#252525] border-[#333] text-white'
        : 'bg-white border-gray-300 text-gray-900'
        }`;

    const labelClass = `block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-700'}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-2xl transform rounded-2xl shadow-2xl transition-all ${isDark ? 'bg-[#1e1e1e] border border-[#2a2a2a]' : 'bg-white'}`}>

                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {isEditMode ? 'Edit Promo Code' : 'Create Promo Code'}
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">

                    {error && (
                        <div className={`p-4 rounded-lg flex items-center space-x-2 ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Code */}
                        <div>
                            <label className={labelClass}>Code</label>
                            <input
                                type="text"
                                name="code"
                                value={formData.code}
                                onChange={(e) => handleChange({ target: { name: 'code', value: e.target.value.toUpperCase() } })}
                                placeholder="SUMMER2025"
                                required
                                disabled={isEditMode} // Usually codes are immutable or need generic update logic
                                className={`${inputClass} font-mono`}
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className={labelClass}>Status</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>

                        {/* Discount Type */}
                        <div>
                            <label className={labelClass}>Discount Type</label>
                            <select
                                name="discountType"
                                value={formData.discountType}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="PERCENTAGE">Percentage (%)</option>
                                <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
                            </select>
                        </div>

                        {/* Discount Value */}
                        <div>
                            <label className={labelClass}>Value</label>
                            <input
                                type="number"
                                name="discountValue"
                                value={formData.discountValue}
                                onChange={handleChange}
                                placeholder="20"
                                required
                                min="0"
                                step="0.01"
                                className={inputClass}
                            />
                        </div>

                        {/* Valid From */}
                        <div>
                            <label className={labelClass}>Valid From</label>
                            <input
                                type="datetime-local"
                                name="validFrom"
                                value={formData.validFrom}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>

                        {/* Valid Until */}
                        <div>
                            <label className={labelClass}>Valid Until</label>
                            <input
                                type="datetime-local"
                                name="validUntil"
                                value={formData.validUntil}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>

                        {/* Max Uses */}
                        <div>
                            <label className={labelClass}>Global Usage Limit</label>
                            <input
                                type="number"
                                name="maxUses"
                                value={formData.maxUses}
                                onChange={handleChange}
                                placeholder="Unlimited"
                                min="0"
                                className={inputClass}
                            />
                        </div>

                        {/* Per User Limit */}
                        <div>
                            <label className={labelClass}>Limit Per User</label>
                            <input
                                type="number"
                                name="maxUsesPerUser"
                                value={formData.maxUsesPerUser}
                                onChange={handleChange}
                                placeholder="1"
                                min="1"
                                className={inputClass}
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className={`p-6 border-t flex justify-end space-x-3 ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
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
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save size={18} />
                                <span>Save Promo Code</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PromoCodeModal;
