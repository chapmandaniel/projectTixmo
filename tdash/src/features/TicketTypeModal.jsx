import React, { useState, useEffect } from 'react';
import { X, DollarSign, Users, Calendar, AlertCircle } from 'lucide-react';
import api from '../lib/api';

const TicketTypeModal = ({ isOpen, onClose, eventId, isDark, onSuccess, initialData = null }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        quantity: '',
        maxPerOrder: 10,
        salesStart: '',
        salesEnd: '',
        status: 'ACTIVE'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                description: initialData.description || '',
                price: initialData.price || '',
                quantity: initialData.quantity || '',
                maxPerOrder: initialData.maxPerOrder || 10,
                salesStart: initialData.salesStart ? new Date(initialData.salesStart).toISOString().slice(0, 16) : '',
                salesEnd: initialData.salesEnd ? new Date(initialData.salesEnd).toISOString().slice(0, 16) : '',
                status: initialData.status || 'ACTIVE'
            });
        } else {
            setFormData({
                name: '',
                description: '',
                price: '',
                quantity: '',
                maxPerOrder: 10,
                salesStart: '',
                salesEnd: '',
                status: 'ACTIVE'
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const payload = {
                eventId, // Only needed for create, but safe to send or can be ignored by backend on update
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                quantity: parseInt(formData.quantity, 10),
                maxPerOrder: parseInt(formData.maxPerOrder, 10),
                status: formData.status,
                // Only include dates if they are set
                ...(formData.salesStart ? { salesStart: new Date(formData.salesStart).toISOString() } : {}),
                ...(formData.salesEnd ? { salesEnd: new Date(formData.salesEnd).toISOString() } : {})
            };

            if (initialData) {
                await api.put(`/ticket-types/${initialData.id}`, payload);
            } else {
                await api.post('/ticket-types', payload);
            }

            onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to save ticket type:', err);
            setError(err.response?.data?.message || err.message || 'Failed to save ticket type');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-lg p-6 rounded-xl shadow-2xl scale-100 transition-all ${isDark ? 'bg-[#1e1e1e] border border-[#333]' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        {initialData ? 'Edit Ticket Type' : 'Create Ticket Type'}
                    </h2>
                    <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center space-x-2 text-rose-500 text-sm">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div>
                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Ticket Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. General Admission, VIP"
                            className={`w-full px-4 py-2 rounded-lg outline-none border transition-colors ${isDark ? 'bg-[#252525] border-[#333] text-white focus:border-indigo-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'}`}
                        />
                    </div>

                    <div>
                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="What's included in this ticket?"
                            rows="2"
                            className={`w-full px-4 py-2 rounded-lg outline-none border transition-colors ${isDark ? 'bg-[#252525] border-[#333] text-white focus:border-indigo-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'}`}
                        />
                    </div>

                    <div>
                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className={`w-full px-4 py-2 rounded-lg outline-none border transition-colors appearance-none ${isDark ? 'bg-[#252525] border-[#333] text-white focus:border-indigo-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'}`}
                        >
                            <option value="ACTIVE">Active (On Sale)</option>
                            <option value="HIDDEN">Hidden (Not visible)</option>
                            <option value="SOLD_OUT">Sold Out</option>
                            <option value="PAUSED">Paused</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Price</label>
                            <div className="relative">
                                <DollarSign size={16} className={`absolute left-3 top-2.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    className={`w-full pl-9 pr-4 py-2 rounded-lg outline-none border transition-colors ${isDark ? 'bg-[#252525] border-[#333] text-white focus:border-indigo-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'}`}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Quantity Available</label>
                            <div className="relative">
                                <Users size={16} className={`absolute left-3 top-2.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                    className={`w-full pl-9 pr-4 py-2 rounded-lg outline-none border transition-colors ${isDark ? 'bg-[#252525] border-[#333] text-white focus:border-indigo-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'}`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Sales Start (Optional)</label>
                            <input
                                type="datetime-local"
                                value={formData.salesStart}
                                onChange={(e) => setFormData({ ...formData, salesStart: e.target.value })}
                                className={`w-full px-4 py-2 rounded-lg outline-none border transition-colors ${isDark ? 'bg-[#252525] border-[#333] text-white focus:border-indigo-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'}`}
                            />
                        </div>
                        <div>
                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Sales End (Optional)</label>
                            <input
                                type="datetime-local"
                                value={formData.salesEnd}
                                onChange={(e) => setFormData({ ...formData, salesEnd: e.target.value })}
                                className={`w-full px-4 py-2 rounded-lg outline-none border transition-colors ${isDark ? 'bg-[#252525] border-[#333] text-white focus:border-indigo-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'}`}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`mr-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#333]' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (initialData ? 'Saving...' : 'Creating...') : (initialData ? 'Save Changes' : 'Create Ticket')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TicketTypeModal;
