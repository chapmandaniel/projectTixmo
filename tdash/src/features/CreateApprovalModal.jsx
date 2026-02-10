import React, { useState, useEffect } from 'react';
import { X, Upload, Calendar, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

const PRIORITIES = [
    { value: 'STANDARD', label: 'Standard', description: 'Normal review timeline' },
    { value: 'URGENT', label: 'Urgent', description: 'Needs attention soon' },
    { value: 'CRITICAL', label: 'Critical', description: 'Immediate feedback required' },
];

const CreateApprovalModal = ({ isDark, events, onClose, onCreate }) => {
    const [formData, setFormData] = useState({
        eventId: '',
        title: '',
        description: '',
        instructions: '',
        priority: 'STANDARD',
        dueDate: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.eventId || !formData.title) {
            setError('Please fill in all required fields');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const payload = {
                ...formData,
                dueDate: formData.dueDate || undefined,
            };

            const response = await api.post('/approvals', payload);
            onCreate(response);
        } catch (err) {
            console.error('Failed to create approval:', err);
            setError(err.message || 'Failed to create approval request');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl ${isDark ? 'bg-[#1A1A1A]' : 'bg-white'
                }`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'
                    }`}>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        New Approval Request
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Event */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Event <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.eventId}
                            onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                            className={`w-full px-4 py-3 rounded-lg border transition-colors ${isDark
                                    ? 'bg-[#0A0A0A] border-gray-800 text-white focus:border-indigo-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'
                                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                            required
                        >
                            <option value="">Select an event</option>
                            {events.map((event) => (
                                <option key={event.id} value={event.id}>{event.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Title */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g., Event Poster - Final Design"
                            className={`w-full px-4 py-3 rounded-lg border transition-colors ${isDark
                                    ? 'bg-[#0A0A0A] border-gray-800 text-white placeholder-gray-600 focus:border-indigo-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Brief description of what's being reviewed..."
                            rows={3}
                            className={`w-full px-4 py-3 rounded-lg border transition-colors resize-none ${isDark
                                    ? 'bg-[#0A0A0A] border-gray-800 text-white placeholder-gray-600 focus:border-indigo-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                        />
                    </div>

                    {/* Instructions */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Review Instructions
                        </label>
                        <textarea
                            value={formData.instructions}
                            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                            placeholder="What should reviewers focus on? Any specific feedback needed?"
                            rows={2}
                            className={`w-full px-4 py-3 rounded-lg border transition-colors resize-none ${isDark
                                    ? 'bg-[#0A0A0A] border-gray-800 text-white placeholder-gray-600 focus:border-indigo-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                        />
                    </div>

                    {/* Priority & Due Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Priority
                            </label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className={`w-full px-4 py-3 rounded-lg border transition-colors ${isDark
                                        ? 'bg-[#0A0A0A] border-gray-800 text-white focus:border-indigo-500'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'
                                    } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                            >
                                {PRIORITIES.map((p) => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                className={`w-full px-4 py-3 rounded-lg border transition-colors ${isDark
                                        ? 'bg-[#0A0A0A] border-gray-800 text-white focus:border-indigo-500'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'
                                    } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`px-4 py-2 rounded-lg transition-colors ${isDark
                                    ? 'text-gray-400 hover:bg-gray-800'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Creating...' : 'Create Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateApprovalModal;
