import React, { useState } from 'react';
import { AlertTriangle, X, Send, CheckCircle2 } from 'lucide-react';

const GlobalErrorNotification = ({ error, onClose, isDark = true }) => {
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    if (!error) return null;

    const handleSendReport = async () => {
        setSending(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('Report sent for error:', error);
        setSending(false);
        setSent(true);
        setTimeout(() => {
            onClose();
        }, 2000);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up max-w-md w-full">
            <div className={`${isDark ? 'bg-[#1E1E1E] border-red-900/50' : 'bg-white border-red-200'} border rounded-xl shadow-2xl p-4 overflow-hidden relative`}>

                {/* Progress bar for "sending" state */}
                {sending && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-900/30">
                        <div className="h-full bg-red-500 animate-progress"></div>
                    </div>
                )}

                <div className="flex items-start gap-4">
                    <div className="p-2 bg-red-500/10 rounded-lg shrink-0">
                        {sent ? (
                            <CheckCircle2 size={24} className="text-green-500" />
                        ) : (
                            <AlertTriangle size={24} className="text-red-500" />
                        )}
                    </div>

                    <div className="flex-1">
                        <h3 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {sent ? 'Report Sent' : 'Something went wrong'}
                        </h3>
                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {sent
                                ? 'Thanks for your feedback. Our team has been notified.'
                                : (error.message || 'An unexpected error occurred while processing your request.')}
                        </p>

                        {!sent && error.code && (
                            <div className={`mt-2 text-xs font-mono p-1.5 rounded ${isDark ? 'bg-black/30 text-red-400' : 'bg-gray-100 text-red-600'}`}>
                                Error Code: {error.code}
                            </div>
                        )}

                        {!sent && (
                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={handleSendReport}
                                    disabled={sending}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${isDark
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-red-600 hover:bg-red-700 text-white'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {sending ? 'Sending...' : (
                                        <>
                                            <Send size={16} />
                                            Send Report
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={onClose}
                                    disabled={sending}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${isDark
                                            ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                                            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}
                    </div>

                    {!sent && (
                        <button
                            onClick={onClose}
                            className={`shrink-0 p-1 rounded-lg transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlobalErrorNotification;
