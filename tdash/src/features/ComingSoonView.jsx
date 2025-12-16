import React from 'react';
import { Settings } from 'lucide-react';

const ComingSoonView = ({ title, isDark }) => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 animate-fade-in">
        <div className={`p-4 rounded-full ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-gray-50 shadow-sm'}`}>
            <Settings size={32} className={isDark ? 'text-gray-600' : 'text-gray-300'} />
        </div>
        <h2 className={`text-xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{title}</h2>
        <p className={`${isDark ? 'text-gray-500' : 'text-gray-500'} max-w-md text-sm`}>
            This module is available in the Enterprise API plan.
        </p>
    </div>
);

export default ComingSoonView;
