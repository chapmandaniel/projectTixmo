import React, { useState, useCallback, useRef } from 'react';
import { X, Plus, User, Mail, Loader2, Check } from 'lucide-react';

const ReviewerSelector = ({
    reviewers = [],
    onAdd,
    onRemove,
    isDark,
    disabled = false
}) => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [adding, setAdding] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState(null);
    const emailInputRef = useRef(null);

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleAdd = async () => {
        if (!email.trim()) {
            setError('Email is required');
            return;
        }
        if (!validateEmail(email)) {
            setError('Invalid email address');
            return;
        }
        if (reviewers.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
            setError('Reviewer already added');
            return;
        }

        try {
            setAdding(true);
            setError(null);
            await onAdd({ email: email.trim(), name: name.trim() || undefined });
            setEmail('');
            setName('');
            setShowForm(false);
        } catch (err) {
            setError(err.message || 'Failed to add reviewer');
        } finally {
            setAdding(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAdd();
        }
        if (e.key === 'Escape') {
            setShowForm(false);
            setEmail('');
            setName('');
            setError(null);
        }
    };

    const openForm = () => {
        setShowForm(true);
        setTimeout(() => emailInputRef.current?.focus(), 100);
    };

    const getDecisionBadge = (decision) => {
        if (!decision) return null;
        const styles = {
            APPROVED: 'bg-green-500/20 text-green-400',
            REJECTED: 'bg-red-500/20 text-red-400',
            CHANGES_REQUESTED: 'bg-orange-500/20 text-orange-400',
        };
        const labels = {
            APPROVED: 'Approved',
            REJECTED: 'Rejected',
            CHANGES_REQUESTED: 'Changes',
        };
        return (
            <span className={`text-xs px-2 py-0.5 rounded-full ${styles[decision]}`}>
                {labels[decision]}
            </span>
        );
    };

    return (
        <div className="space-y-3">
            {/* Reviewer List */}
            {reviewers.map((reviewer) => (
                <div
                    key={reviewer.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'
                        }`}
                >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-700'
                        }`}>
                        {reviewer.name?.[0] || reviewer.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {reviewer.name || reviewer.email}
                        </p>
                        {reviewer.name && (
                            <p className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {reviewer.email}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {reviewer.decision ? (
                            getDecisionBadge(reviewer.decision)
                        ) : reviewer.viewedAt ? (
                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                Viewed
                            </span>
                        ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                                }`}>
                                Pending
                            </span>
                        )}
                        {!disabled && !reviewer.decision && (
                            <button
                                onClick={() => onRemove(reviewer.id)}
                                className="p-1 rounded hover:bg-red-500/20 text-red-400"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            ))}

            {/* Add Reviewer Form */}
            {showForm && !disabled && (
                <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                    }`}>
                    <div className="space-y-3">
                        <div>
                            <div className="relative">
                                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'
                                    }`} />
                                <input
                                    ref={emailInputRef}
                                    type="email"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="reviewer@example.com"
                                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${isDark
                                            ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                                        } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="relative">
                                <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'
                                    }`} />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Name (optional)"
                                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${isDark
                                            ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                                        } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-sm text-red-400">{error}</p>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => { setShowForm(false); setEmail(''); setName(''); setError(null); }}
                                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${isDark
                                        ? 'text-gray-400 hover:bg-gray-700'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAdd}
                                disabled={adding || !email.trim()}
                                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {adding ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Add
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Button */}
            {!showForm && !disabled && (
                <button
                    onClick={openForm}
                    className={`w-full py-3 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${isDark
                            ? 'border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300'
                            : 'border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-600'
                        }`}
                >
                    <Plus className="w-5 h-5" />
                    Add Reviewer
                </button>
            )}

            {reviewers.length === 0 && !showForm && (
                <p className={`text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No reviewers added yet
                </p>
            )}
        </div>
    );
};

export default ReviewerSelector;
