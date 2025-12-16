import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { MOCK_ANALYTICS_DATA, TICKET_TYPE_DISTRIBUTION, COLORS, DARK_COLORS } from '../data/mockData';

const AnalyticsView = ({ isDark }) => (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
        <div>
            <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Analytics</h2>
            <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm`}>Performance insights and customer data.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Ticket Type Distribution Pie Chart */}
            <div className={`p-5 rounded-xl flex flex-col items-center justify-center ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
                <h3 className={`text-lg font-medium mb-6 w-full text-left ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Ticket Breakdown</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={TICKET_TYPE_DISTRIBUTION}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {TICKET_TYPE_DISTRIBUTION.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={isDark ? DARK_COLORS[index % DARK_COLORS.length] : COLORS[index % COLORS.length]} strokeWidth={0} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: isDark ? '#252525' : '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.2)', color: isDark ? '#e5e5e5' : '#374151' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Comparison Bar Chart */}
            <div className={`lg:col-span-2 p-5 rounded-xl ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
                <h3 className={`text-lg font-medium mb-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Check-ins vs Sales</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={MOCK_ANALYTICS_DATA}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            barSize={32}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2a2a2a' : '#f3f4f6'} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#525252' : '#9ca3af', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#525252' : '#9ca3af', fontSize: 12 }} />
                            <Tooltip cursor={{ fill: isDark ? '#2a2a2a' : '#f9fafb' }} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: isDark ? '#252525' : '#fff', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.2)', color: isDark ? '#e5e5e5' : '#374151' }} />
                            <Legend />
                            <Bar dataKey="sales" fill={isDark ? '#6366f1' : '#374151'} radius={[4, 4, 0, 0]} name="Revenue ($)" />
                            <Bar dataKey="tickets" fill={isDark ? '#525252' : '#d1d5db'} radius={[4, 4, 0, 0]} name="Tickets Vol" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    </div>
);

export default AnalyticsView;
