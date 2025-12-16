import React from 'react';
import { TrendingUp } from 'lucide-react';

const StatCard = ({ title, value, trend, trendUp, isDark }) => (
    <div className={`${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'} p-5 rounded-xl transition-all`}>
        <h3 className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm font-normal mb-1`}>{title}</h3>
        <div className="flex items-baseline space-x-3">
            <p className={`${isDark ? 'text-gray-200' : 'text-gray-700'} text-3xl font-medium tracking-tight`}>{value}</p>
            <div className={`flex items-center text-xs font-medium ${trendUp ? 'text-emerald-600' : 'text-rose-600'} ${isDark ? 'bg-[#252525]' : 'bg-gray-50'} px-2 py-0.5 rounded-full`}>
                {trendUp ? <TrendingUp size={12} className="mr-1" /> : <TrendingUp size={12} className="mr-1 rotate-180" />}
                <span>{trend}</span>
            </div>
        </div>
    </div>
);

export default StatCard;
