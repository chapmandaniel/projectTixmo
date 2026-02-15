import React, { useState, useEffect } from 'react';
import { X, Upload, Calendar, AlertTriangle, UserPlus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

const PRIORITIES = [
    { value: 'STANDARD', label: 'Standard', description: 'Normal review timeline' },
    { value: 'URGENT', label: 'Urgent', description: 'Needs attention soon' },
    { value: 'CRITICAL', label: 'Critical', description: 'Immediate feedback required' },
];

const ALLOWED_FILE_TYPES = "image/*,.pdf,.svg,video/mp4,video/webm";

const CreateApprovalModal = ({ isDark, events, onClose, onCreate }) => {
    const [formData, setFormData] = useState({
        eventId: '',
        title: '',
        description: '',
        instructions: '',
        priority: 'STANDARD',
        dueDate: '',
    });
    const [reviewers, setReviewers] = useState([]);
    const [reviewerEmail, setReviewerEmail] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [formErrors, setFormErrors] = useState({});

    // Cleanup object URLs on unmount
    useEffect(() => {
        return () => {
            selectedFiles.forEach(file => {
                if (file.preview) URL.revokeObjectURL(file.preview);
            });
        };
    }, []);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        // Basic frontend validation for type - strict check done on backend
        // We allow images, pdfs, videos
        const validFiles = files.filter(file =>
            file.type.startsWith('image/') ||
            file.type === 'application/pdf' ||
            file.type.startsWith('video/')
        );

        if (validFiles.length !== files.length) {
            setError('Some files were skipped. Only images, PDFs, and videos are allowed.');
        } else {
            setError(null);
        }

        const newFiles = validFiles.map(file => {
            file.preview = URL.createObjectURL(file);
            return file;
        });

        setSelectedFiles(prev => [...prev, ...newFiles]);
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => {
            const fileToRemove = prev[index];
            if (fileToRemove.preview) URL.revokeObjectURL(fileToRemove.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const addReviewer = (e) => {
        e.preventDefault();
        if (!reviewerEmail) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewerEmail)) {
            setFormErrors(prev => ({ ...prev, reviewer: 'Invalid email address' }));
            return;
        }
        if (reviewers.some(r => r.email === reviewerEmail)) {
            setFormErrors(prev => ({ ...prev, reviewer: 'Reviewer already added' }));
            return;
        }

        setReviewers([...reviewers, { email: reviewerEmail }]);
        setReviewerEmail('');
        setFormErrors(prev => ({ ...prev, reviewer: null }));
    };

    const removeReviewer = (email) => {
        setReviewers(reviewers.filter(r => r.email !== email));
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.eventId) errors.eventId = 'Event is required';
        if (!formData.title) errors.title = 'Title is required';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (submitType = 'create') => { // 'create' or 'create_submit'
        if (!validateForm()) {
            setError('Please fix the errors below');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            // 1. Create Approval Request
            const payload = {
                ...formData,
                dueDate: formData.dueDate ? new Date(`${formData.dueDate}T23:59:59Z`).toISOString() : undefined,
            };

            const response = await api.post('/approvals', payload);
            let approval = response.approval || response;

            // 2. Upload Assets
            if (selectedFiles.length > 0 && approval.id) {
                setUploading(true);
                const assetFormData = new FormData();
                selectedFiles.forEach(file => {
                    assetFormData.append('files', file);
                });

                await api.upload(`/approvals/${approval.id}/assets`, assetFormData);
            }

            // 3. Add Reviewers
            if (reviewers.length > 0 && approval.id) {
                await api.post(`/approvals/${approval.id}/reviewers`, {
                    reviewers: reviewers.map(r => ({ email: r.email }))
                });
            }

            // 4. Submit for Review (if requested)
            if (submitType === 'create_submit' && approval.id) {
                // We need to fetch the fresh approval first to ensure backend sees assets/reviewers
                // But wait, our API just needs ID.
                await api.post(`/approvals/${approval.id}/submit`);
            }

            // Fetch final state
            const finalResponse = await api.get(`/approvals/${approval.id}`);
            onCreate(finalResponse.approval || finalResponse);

        } catch (err) {
            console.error('Failed to create approval:', err);
            setError(err.response?.data?.message || err.message || 'Failed to create approval request');
        } finally {
            setSubmitting(false);
            setUploading(false);
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
            <div className={`relative w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] ${isDark ? 'bg-[#1A1A1A]' : 'bg-white'
                }`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b flex-shrink-0 ${isDark ? 'border-gray-800' : 'border-gray-200'
                    }`}>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
                <div className="p-6 space-y-6 overflow-y-auto">
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Event */}
                        <div>
                            <label htmlFor="event-select" className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Event <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="event-select"
                                value={formData.eventId}
                                onChange={(e) => {
                                    setFormData({ ...formData, eventId: e.target.value });
                                    setFormErrors(prev => ({ ...prev, eventId: null }));
                                }}
                                className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark
                                    ? 'bg-[#0A0A0A] border-gray-800 text-white focus:border-indigo-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'
                                    } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${formErrors.eventId ? 'border-red-500 focus:border-red-500' : ''}`}
                            >
                                <option value="">Select an event</option>
                                {events.map((event) => (
                                    <option key={event.id} value={event.id}>{event.name}</option>
                                ))}
                            </select>
                            {formErrors.eventId && <p className="text-xs text-red-500 mt-1">{formErrors.eventId}</p>}
                        </div>

                        {/* Title */}
                        <div>
                            <label htmlFor="title-input" className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="title-input"
                                type="text"
                                value={formData.title}
                                onChange={(e) => {
                                    setFormData({ ...formData, title: e.target.value });
                                    setFormErrors(prev => ({ ...prev, title: null }));
                                }}
                                placeholder="e.g., Event Poster - Final Design"
                                className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark
                                    ? 'bg-[#0A0A0A] border-gray-800 text-white placeholder-gray-600 focus:border-indigo-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                                    } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${formErrors.title ? 'border-red-500 focus:border-red-500' : ''}`}
                            />
                            {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
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

                    {/* Assets Upload */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Assets
                        </label>
                        <div className={`border-2 border-dashed rounded-xl p-6 transition-colors ${isDark ? 'border-gray-800 hover:border-gray-700' : 'border-gray-200 hover:border-gray-300'
                            }`}>
                            <div className="flex flex-col items-center justify-center gap-2 cursor-pointer relative">
                                <input
                                    type="file"
                                    multiple
                                    accept={ALLOWED_FILE_TYPES}
                                    onChange={handleFileSelect}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className={`p-3 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                    <Upload className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                </div>
                                <div className="text-center">
                                    <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Click to upload or drag and drop
                                    </p>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        Images, PDFs, Video (max 5 files, 10MB each)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Selected Files List */}
                        {selectedFiles.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {selectedFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className={`flex items-center justify-between p-2 rounded-lg border ${isDark ? 'bg-[#0A0A0A] border-gray-800' : 'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white border border-gray-200'
                                                }`}>
                                                {file.type.startsWith('image/') ? (
                                                    <img
                                                        src={file.preview}
                                                        alt={file.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <Upload className="w-5 h-5 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {file.name}
                                                </p>
                                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(index)}
                                            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-200 text-gray-400'
                                                }`}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add Reviewers */}
                    <div>
                        <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Reviewers
                        </label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="email"
                                value={reviewerEmail}
                                onChange={(e) => setReviewerEmail(e.target.value)}
                                placeholder="Enter reviewer email"
                                className={`flex-1 px-4 py-2.5 rounded-lg border transition-colors ${isDark
                                    ? 'bg-[#0A0A0A] border-gray-800 text-white placeholder-gray-600 focus:border-indigo-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                                    } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${formErrors.reviewer ? 'border-red-500' : ''}`}
                                onKeyDown={(e) => e.key === 'Enter' && addReviewer(e)}
                            />
                            <button
                                type="button"
                                onClick={addReviewer}
                                className={`px-4 py-2 rounded-lg border font-medium text-sm transition-colors ${isDark
                                    ? 'border-gray-700 hover:bg-gray-800 text-gray-300'
                                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                            >
                                Add
                            </button>
                        </div>
                        {formErrors.reviewer && <p className="text-xs text-red-500 mb-2">{formErrors.reviewer}</p>}

                        {reviewers.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {reviewers.map(r => (
                                    <span key={r.email} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                                        {r.email}
                                        <button onClick={() => removeReviewer(r.email)} className="hover:text-indigo-100"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Instructions */}
                    <div>
                        <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
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
                            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Priority
                            </label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark
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
                            <label htmlFor="due-date-input" className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Due Date
                            </label>
                            <input
                                id="due-date-input"
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                min={new Date().toISOString().split('T')[0]}
                                className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark
                                    ? 'bg-[#0A0A0A] border-gray-800 text-white focus:border-indigo-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500'
                                    } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className={`p-6 border-t flex justify-end gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm ${isDark
                            ? 'text-gray-400 hover:bg-gray-800'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Cancel
                    </button>
                    <button
                        type="button" // Use type=button for the secondary action "Create and Submit"
                        onClick={() => handleSubmit('create')}
                        disabled={submitting || uploading}
                        className={`px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                            }`}
                    >
                        Save Draft
                    </button>
                    {selectedFiles.length > 0 && reviewers.length > 0 && (
                        <button
                            type="button"
                            onClick={() => handleSubmit('create_submit')}
                            disabled={submitting || uploading}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm"
                        >
                            {uploading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                'Create & Submit'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateApprovalModal;
