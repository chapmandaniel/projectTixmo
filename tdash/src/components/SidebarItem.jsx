import React from 'react';

const SidebarItem = ({ icon: Icon, label, active, onClick, isDark }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-4 py-2 rounded-lg transition-all duration-200 group ${active
                ? isDark ? 'bg-[#252525] text-gray-200' : 'bg-white text-gray-800 shadow-sm'
                : isDark ? 'text-gray-500 hover:bg-[#1e1e1e] hover:text-gray-300' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
            }`}
    >
        <div className="flex items-center space-x-3">
            <Icon size={18} className={active ? (isDark ? 'text-gray-200' : 'text-gray-800') : (isDark ? 'text-gray-600 group-hover:text-gray-400' : 'text-gray-400 group-hover:text-gray-600')} />
            <span className="text-sm font-normal">{label}</span>
        </div>
        {active && <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-indigo-400' : 'bg-gray-800'}`} />}
    </button>
);

export default SidebarItem;
