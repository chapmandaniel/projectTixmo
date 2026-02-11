import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        // Here you could log to an external service like Sentry
    }

    render() {
        if (this.state.hasError) {
            const isDark = this.props.isDark !== false;

            return (
                <div className={`min-h-screen flex items-center justify-center p-6 ${isDark ? 'bg-[#141414] text-white' : 'bg-gray-50 text-gray-900'}`}>
                    <div className={`max-w-md w-full p-8 rounded-2xl shadow-2xl text-center border ${isDark ? 'bg-[#1e1e1e] border-gray-800' : 'bg-white border-gray-100'}`}>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 mb-6">
                            <AlertTriangle size={32} />
                        </div>

                        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
                        <p className={`text-sm mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            An unexpected interface error occurred. We've been notified and are looking into it.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            >
                                <RefreshCw size={18} />
                                Refresh Application
                            </button>

                            <button
                                onClick={() => {
                                    localStorage.clear();
                                    window.location.href = '/';
                                }}
                                className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
                            >
                                <Home size={18} />
                                Return to Home
                            </button>
                        </div>

                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 text-left">
                                <p className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wider">Error Details:</p>
                                <div className={`p-3 rounded-lg text-xs font-mono overflow-auto max-h-32 text-left ${isDark ? 'bg-black/50 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                                    {this.state.error?.toString()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
