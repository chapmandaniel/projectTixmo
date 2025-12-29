import React, { useState } from 'react';
import { Ticket, Lock, Mail, Loader } from 'lucide-react';
import { auth } from '../lib/auth';

const LoginView = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const user = await auth.login(email, password);
            onLogin(user);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#121212] font-sans selection:bg-indigo-500/30">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Exo:ital,wght@0,100..900;1,100..900&display=swap');
            `}</style>

            <div className="w-full max-w-md p-8 animate-fade-in">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20">
                        <Ticket size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome Back</h1>
                    <p className="text-gray-400">Sign in to your TixMo dashboard</p>
                </div>

                <div className="bg-[#1e1e1e] rounded-2xl p-8 shadow-2xl border border-[#333]">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center">
                                <span className="mr-2">⚠️</span> {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#121212] border border-[#333] rounded-xl px-12 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Password</label>
                            <div className="relative group">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#121212] border border-[#333] rounded-xl px-12 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {loading ? (
                                <>
                                    <Loader size={20} className="animate-spin mr-2" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center mt-8 text-sm text-gray-500">
                    Don't have an account? <a href="#" className="text-indigo-400 hover:text-indigo-300 transition-colors">Contact Support</a>
                </p>
            </div>
        </div>
    );
};

export default LoginView;
