import React, { useState, useEffect } from 'react';
import {
    X,
    Save,
    MapPin,
    Calendar,
    Users,
    Image as ImageIcon,
    Type,
    CheckCircle,
    AlertCircle,
    Upload,
    Plus,
    Trash2,
    Instagram,
    Facebook,
    Twitter,
    Linkedin,
    Layout,
    Smartphone,
    Monitor
} from 'lucide-react';
import { api } from '../lib/api';

const ApprovalStudio = ({ onClose, onSuccess, isDark, user, initialData = null }) => {
    const [activeSection, setActiveSection] = useState('basics');
    const [previewMode, setPreviewMode] = useState('mobile');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [events, setEvents] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        eventId: '',
        type: 'MEDIA', // MEDIA, SOCIAL
        priority: 'STANDARD',
        dueDate: '',
        description: '',
        instructions: '',
        // Social specific
        content: {
            platform: 'instagram',
            caption: '',
            hashtags: ''
        }
    });

    const [files, setFiles] = useState([]);
    const [reviewers, setReviewers] = useState([]);
    const [reviewerInput, setReviewerInput] = useState('');

    useEffect(() => {
        fetchEvents();
        if (initialData) {
            // Populate form if editing
            setFormData({
                title: initialData.title || '',
                eventId: initialData.eventId || '',
                type: initialData.type || 'MEDIA',
                priority: initialData.priority || 'STANDARD',
                dueDate: initialData.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : '',
                description: initialData.description || '',
                instructions: initialData.instructions || '',
                content: initialData.content || { platform: 'instagram', caption: '', hashtags: '' }
            });
            // TODO: Handle files and reviewers for edit mode
        }
    }, [initialData]);

    const fetchEvents = async () => {
        try {
            const res = await api.get('/events');
            setEvents(res.data.events || []);
        } catch (err) {
            console.error('Failed to fetch events', err);
        }
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const addReviewer = (e) => {
        e.preventDefault();
        if (reviewerInput && !reviewers.some(r => r.email === reviewerInput)) {
            setReviewers([...reviewers, { email: reviewerInput }]);
            setReviewerInput('');
        }
    };

    const removeReviewer = (email) => {
        setReviewers(reviewers.filter(r => r.email !== email));
    };

    const handleSubmit = async (submitType = 'save') => { // save (draft) or submit (pending)
        setLoading(true);
        setError(null);

        // Client-side validation
        if (!formData.title?.trim()) {
            setError('Please enter a title');
            setLoading(false);
            return;
        }
        if (!formData.eventId) {
            setError('Please select an event');
            setLoading(false);
            return;
        }

        try {
            // Step 1: Create Approval
            const payload = {
                title: formData.title,
                eventId: formData.eventId,
                type: formData.type,
                priority: formData.priority,
                dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
                description: formData.description,
                instructions: formData.instructions,
                content: formData.type === 'SOCIAL' ? formData.content : undefined,
                organizationId: user.organizationId // Ensure we send org ID if needed
            };

            const res = await api.post('/approvals', payload);
            const approvalId = res.id;

            // Step 2: Upload Files (if any)
            if (files.length > 0) {
                const assetData = new FormData();
                files.forEach(file => {
                    assetData.append('files', file);
                });

                await api.upload(`/approvals/${approvalId}/assets`, assetData);
            }

            // Step 3: Add Reviewers
            if (reviewers.length > 0) {
                await api.post(`/approvals/${approvalId}/reviewers`, {
                    reviewers: reviewers
                });
            }

            // Step 4: Submit if requested
            if (submitType === 'submit') {
                await api.post(`/approvals/${approvalId}/submit`);
            }

            onSuccess();
            onClose();

        } catch (err) {
            console.error('Submit error:', err);
            const msg = err.response?.data?.message || err.message || 'Failed to create approval';
            setError(msg);
            // Dump full error to console for debugging
            if (err.response?.data) {
                console.error('Error details:', err.response.data);
            }
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER HELPERS ---

    const renderNav = () => (
        <div className={`w-64 flex flex-col border-r ${isDark ? 'border-gray-800 bg-[#1A1A1A]' : 'border-gray-200 bg-white'}`}>
            <div className="p-4 border-b border-gray-800/50">
                <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Approval Studio</h2>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Create & Manage Approvals</p>
            </div>
            <nav className="flex-1 p-2 space-y-1">
                {[
                    { id: 'basics', label: 'Basics', icon: Layout },
                    { id: 'content', label: 'Content & Assets', icon: ImageIcon },
                    { id: 'reviewers', label: 'Reviewers', icon: Users },
                    { id: 'instructions', label: 'Instructions', icon: Type }
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeSection === item.id
                            ? isDark ? 'bg-blue-600/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                            : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                    </button>
                ))}
            </nav>
        </div>
    );

    const renderBasics = () => (
        <div className="space-y-6 max-w-2xl">
            <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Approval Title <span className="text-red-400">*</span>
                </label>
                <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDark
                        ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                        : 'bg-white border-gray-300 text-gray-900'
                        }`}
                    placeholder="e.g., Summer Festival Instagram Post"
                />
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Type
                    </label>
                    <div className="flex bg-gray-100 p-1 rounded-lg dark:bg-gray-800">
                        {['MEDIA', 'SOCIAL'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFormData({ ...formData, type })}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formData.type === type
                                    ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                    }`}
                            >
                                {type === 'MEDIA' ? 'Media Asset' : 'Social Post'}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Event <span className="text-red-400">*</span>
                    </label>
                    <select
                        value={formData.eventId}
                        onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                        className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDark
                            ? 'bg-gray-900 border-gray-700 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                            }`}
                    >
                        <option value="">Select Event</option>
                        {events.map(event => (
                            <option key={event.id} value={event.id}>{event.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Priority
                    </label>
                    <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDark
                            ? 'bg-gray-900 border-gray-700 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                            }`}
                    >
                        <option value="STANDARD">Standard</option>
                        <option value="URGENT">Urgent</option>
                        <option value="CRITICAL">Critical</option>
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
                        className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDark
                            ? 'bg-gray-900 border-gray-700 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                            }`}
                    />
                </div>
            </div>

            <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Description
                </label>
                <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDark
                        ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                        : 'bg-white border-gray-300 text-gray-900'
                        }`}
                    placeholder="Brief description of this approval request..."
                />
            </div>
        </div>
    );

    const renderContent = () => (
        <div className="space-y-6 max-w-2xl">
            {formData.type === 'SOCIAL' && (
                <div className="space-y-4 p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Social Post Details</h3>

                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Platform
                        </label>
                        <div className="flex gap-4">
                            {['instagram', 'facebook', 'twitter', 'linkedin'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setFormData({
                                        ...formData,
                                        content: { ...formData.content, platform: p }
                                    })}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${formData.content.platform === p
                                        ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                        : isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {p === 'instagram' && <Instagram className="w-4 h-4" />}
                                    {p === 'facebook' && <Facebook className="w-4 h-4" />}
                                    {p === 'twitter' && <Twitter className="w-4 h-4" />}
                                    {p === 'linkedin' && <Linkedin className="w-4 h-4" />}
                                    <span className="capitalize">{p}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Caption
                        </label>
                        <textarea
                            value={formData.content.caption}
                            onChange={(e) => setFormData({
                                ...formData,
                                content: { ...formData.content, caption: e.target.value }
                            })}
                            rows={4}
                            className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDark
                                ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                                : 'bg-white border-gray-300 text-gray-900'
                                }`}
                            placeholder="Write your post caption..."
                        />
                    </div>
                </div>
            )}

            <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {formData.type === 'SOCIAL' ? 'Media Assets' : 'Upload Files'}
                </label>
                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDark
                    ? 'border-gray-700 hover:border-gray-600 bg-gray-900/50'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                    }`}>
                    <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className={`w-10 h-10 mx-auto mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span className="text-blue-500 font-medium">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            PNG, JPG, PDF up to 10MB
                        </p>
                    </label>
                </div>

                {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {files.map((file, idx) => (
                            <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                                        <ImageIcon className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {file.name}
                                    </span>
                                </div>
                                <button
                                    onClick={() => removeFile(idx)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                >
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderReviewers = () => (
        <div className="space-y-6 max-w-2xl">
            <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Add Reviewers
                </label>
                <form onSubmit={addReviewer} className="flex gap-2">
                    <input
                        type="email"
                        value={reviewerInput}
                        onChange={(e) => setReviewerInput(e.target.value)}
                        className={`flex-1 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDark
                            ? 'bg-gray-900 border-gray-700 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                            }`}
                        placeholder="Enter reviewer email"
                    />
                    <button
                        type="submit"
                        disabled={!reviewerInput}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </form>
            </div>

            {reviewers.length > 0 && (
                <div className="space-y-2">
                    {reviewers.map((reviewer) => (
                        <div key={reviewer.email} className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                    <Users className="w-4 h-4" />
                                </div>
                                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {reviewer.email}
                                </span>
                            </div>
                            <button
                                onClick={() => removeReviewer(reviewer.email)}
                                className="text-red-400 hover:text-red-500 p-1"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderInstructions = () => (
        <div className="space-y-6 max-w-2xl">
            <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Review Instructions
                </label>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Provide guidelines or specific things reviewers should look for.
                </p>
                <textarea
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    rows={8}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDark
                        ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                        : 'bg-white border-gray-300 text-gray-900'
                        }`}
                    placeholder="e.g., Check for brand consistency, correct dates, and logo placement..."
                />
            </div>
        </div>
    );

    const renderPreview = () => {
        const previewImage = files.length > 0 ? URL.createObjectURL(files[0]) : null;

        return (
            <div className={`flex flex-col h-full ${isDark ? 'bg-black' : 'bg-gray-100'}`}>
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Live Preview
                    </span>
                    <div className="flex bg-gray-800 rounded-lg p-1">
                        <button
                            onClick={() => setPreviewMode('mobile')}
                            className={`p-1.5 rounded ${previewMode === 'mobile' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}
                        >
                            <Smartphone className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPreviewMode('desktop')}
                            className={`p-1.5 rounded ${previewMode === 'desktop' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}
                        >
                            <Monitor className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
                    {/* Phone/Device Frame */}
                    <div className={`relative transition-all duration-300 ${previewMode === 'mobile' ? 'w-[375px]' : 'w-[800px]'}`}>
                        <div className={`rounded-xl overflow-hidden shadow-2xl ${isDark ? 'bg-gray-900 ring-1 ring-gray-800' : 'bg-white ring-1 ring-gray-200'}`}>

                            {/* Header Mock */}
                            <div className="h-14 border-b border-gray-800 flex items-center px-4 gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500" />
                                <div>
                                    <div className={`h-3 w-24 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                                    <div className={`h-2 w-16 rounded mt-1 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                                </div>
                            </div>

                            {/* Content */}
                            <div className={`aspect-square w-full flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
                                {previewImage ? (
                                    <img src={previewImage} className="w-full h-full object-cover" alt="Preview" />
                                ) : (
                                    <div className="text-center">
                                        <ImageIcon className={`w-12 h-12 mx-auto mb-2 ${isDark ? 'text-gray-800' : 'text-gray-300'}`} />
                                        <span className={`text-sm ${isDark ? 'text-gray-800' : 'text-gray-300'}`}>No image uploaded</span>
                                    </div>
                                )}
                            </div>

                            {/* Caption Section for Social */}
                            {formData.type === 'SOCIAL' && (
                                <div className="p-4">
                                    <div className="flex gap-4 mb-3">
                                        <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                                        <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                                        <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            Project Tixmo
                                            <span className={`font-normal ml-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {formData.content.caption || 'Your caption will appear here...'}
                                            </span>
                                        </p>
                                        <p className="text-sm text-blue-500">
                                            {formData.content.hashtags}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Media File Info */}
                            {formData.type === 'MEDIA' && (
                                <div className="p-4">
                                    <div className={`p-3 rounded-lg flex items-center justify-between ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                        <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {files.length > 0 ? files[0].name : 'No file selected'}
                                        </span>
                                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {files.length > 0 ? `${(files[0].size / 1024 / 1024).toFixed(2)} MB` : ''}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-black">
            {/* Header */}
            <div className={`h-16 flex items-center justify-between px-6 border-b ${isDark ? 'border-gray-800 bg-[#1A1A1A]' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                    </button>
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formData.title || 'Untitled Approval'}
                    </span>
                    <span className={`px-2 py-0.5 rounded textxs font-medium ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                        {formData.type}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleSubmit('save')}
                        disabled={loading}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                            ? 'text-gray-300 hover:bg-gray-800'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Save Draft
                    </button>
                    <button
                        onClick={() => handleSubmit('submit')}
                        disabled={loading || !formData.title || !formData.eventId}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium shadow-lg shadow-blue-500/25"
                    >
                        {loading ? 'Saving...' : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Submit for Review
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {renderNav()}

                <div className={`flex-1 overflow-y-auto p-12 ${isDark ? 'bg-[#111]' : 'bg-white'}`}>
                    <div className="max-w-3xl mx-auto">
                        <h1 className={`text-2xl font-bold mb-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {activeSection === 'basics' && 'Approval Details'}
                            {activeSection === 'content' && 'Content & Assets'}
                            {activeSection === 'reviewers' && 'Review Team'}
                            {activeSection === 'instructions' && 'Instructions'}
                        </h1>

                        {error && (
                            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                {error}
                            </div>
                        )}

                        {activeSection === 'basics' && renderBasics()}
                        {activeSection === 'content' && renderContent()}
                        {activeSection === 'reviewers' && renderReviewers()}
                        {activeSection === 'instructions' && renderInstructions()}
                    </div>
                </div>

                <div className={`w-[500px] border-l ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                    {renderPreview()}
                </div>
            </div>
        </div>
    );
};

export default ApprovalStudio;
