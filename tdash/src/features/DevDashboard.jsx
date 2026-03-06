import React, { useState, useEffect } from 'react';
import { Terminal, Database, Zap, ShieldAlert } from 'lucide-react';

const DevDashboard = ({ isDark, user }) => {
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('tixmo_dev_settings');
            return saved ? JSON.parse(saved) : { enableAutoEventGeneration: false };
        } catch (e) {
            return { enableAutoEventGeneration: false };
        }
    });

    const toggleSetting = (key) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: !prev[key] };
            localStorage.setItem('tixmo_dev_settings', JSON.stringify(newSettings));
            return newSettings;
        });
    };

    if (user?.role !== 'OWNER' && user?.role !== 'ADMIN') {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                <ShieldAlert size={64} className="text-red-500 mb-4" />
                <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>Access Denied</h2>
                <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>You do not have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-12">
            <div className="flex items-center space-x-3 mb-8">
                <div className={`p-3 rounded-lg ${isDark ? 'bg-[#232336]' : 'bg-indigo-50'}`}>
                    <Terminal size={28} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                </div>
                <div className="flex flex-col space-y-1">
                    <h2 className={`text-3xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        Developer Terminal
                    </h2>
                    <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-base font-light`}>
                        Internal tools and test data generators.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Test Data Generators */}
                <div className={`p-6 rounded-md border ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100 dark:border-[#2b2b40]/60">
                        <Zap size={20} className="text-fuchsia-500" />
                        <h3 className={`text-lg font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Test Features</h3>
                    </div>

                    <div className="space-y-4">
                        <label className={`flex items-center justify-between p-4 rounded-md border cursor-pointer transition-colors ${settings.enableAutoEventGeneration
                                ? (isDark ? 'bg-[#232336] border-indigo-500/50' : 'bg-indigo-50 border-indigo-200')
                                : (isDark ? 'bg-transparent border-[#2b2b40] hover:bg-[#232336]' : 'bg-transparent border-gray-200 hover:bg-gray-50')
                            }`}>
                            <div className="flex flex-col">
                                <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Auto-Generate Event Button</span>
                                <span className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Show a button in the Events Hub to instantly create a mock event.</span>
                            </div>
                            <div className="relative inline-flex items-center ml-4 shrink-0">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.enableAutoEventGeneration}
                                    onChange={() => toggleSetting('enableAutoEventGeneration')}
                                />
                                <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-fuchsia-500`}></div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* System Info */}
                <div className={`p-6 rounded-md border ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100 dark:border-[#2b2b40]/60">
                        <Database size={20} className="text-emerald-500" />
                        <h3 className={`text-lg font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>System Context</h3>
                    </div>

                    <div className={`p-4 rounded-md text-sm font-mono whitespace-pre-wrap overflow-x-auto ${isDark ? 'bg-black/40 text-green-400' : 'bg-gray-900 text-green-400'}`}>
                        {JSON.stringify({
                            userId: user?.id,
                            role: user?.role,
                            orgId: user?.organizationId,
                            apiVersion: 'v2.1.0'
                        }, null, 2)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DevDashboard;
