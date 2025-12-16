import React from 'react';
import { Calendar, Download, ChevronRight } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { MOCK_ANALYTICS_DATA, MOCK_RECENT_ORDERS } from '../data/mockData';

const DashboardHome = ({ isDark }) => (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
            <div>
                <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Overview</h2>
                <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm font-normal`}>Welcome back, here's what's happening today.</p>
            </div>
            <div className="flex space-x-3">
                <button className={`px-4 py-2 text-sm font-normal rounded-lg flex items-center transition-colors ${isDark ? 'bg-[#1e1e1e] text-gray-300 hover:bg-[#252525] shadow-lg shadow-black/10' : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'}`}>
                    <Calendar size={16} className="mr-2 opacity-70" />
                    Last 30 Days
                </button>
                <button className={`px-4 py-2 text-sm font-normal rounded-lg flex items-center shadow-lg ${isDark ? 'bg-indigo-500/90 text-white hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-gray-800 text-white hover:bg-gray-700 shadow-gray-400/20'}`}>
                    <Download size={16} className="mr-2 opacity-80" />
                    Export Report
                </button>
            </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Revenue" value="$284,392" trend="12.5%" trendUp={true} isDark={isDark} />
            <StatCard title="Tickets Sold" value="14,209" trend="8.2%" trendUp={true} isDark={isDark} />
            <StatCard title="Active Events" value="8" trend="2 new" trendUp={true} isDark={isDark} />
            <StatCard title="Conversion Rate" value="4.2%" trend="1.1%" trendUp={false} isDark={isDark} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Sales Analytics Chart */}
            <div className={`lg:col-span-2 p-5 rounded-xl ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Revenue Trends</h3>
                    </div>
                    <div className="flex space-x-4 text-sm">
                        <span className={`flex items-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><div className={`w-2 h-2 rounded-full mr-2 ${isDark ? 'bg-indigo-500' : 'bg-gray-800'}`}></div>Revenue</span>
                        <span className={`flex items-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><div className={`w-2 h-2 rounded-full mr-2 ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div>Target</span>
                    </div>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={MOCK_ANALYTICS_DATA}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={isDark ? '#6366f1' : '#374151'} stopOpacity={0.05} />
                                    <stop offset="95%" stopColor={isDark ? '#6366f1' : '#374151'} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2a2a2a' : '#f3f4f6'} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#525252' : '#9ca3af', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#525252' : '#9ca3af', fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: isDark ? '#252525' : '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.2)', color: isDark ? '#e5e5e5' : '#374151' }}
                                itemStyle={{ color: isDark ? '#e5e5e5' : '#374151' }}
                                formatter={(value) => [`$${value}`, 'Revenue']}
                            />
                            <Area type="monotone" dataKey="sales" stroke={isDark ? '#6366f1' : '#374151'} strokeWidth={1.5} fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Occupancy / Real-time stats */}
            <div className={`p-5 rounded-xl ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Live Now</h3>
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                </div>

                <div className="mb-8">
                    <h4 className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-1`}>Summer Music Fest</h4>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-4`}>Madison Square Garden</p>

                    <div className="flex justify-between text-sm mb-2">
                        <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Occupancy</span>
                        <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>72%</span>
                    </div>
                    <div className={`relative w-full rounded-full h-1.5 mb-6 overflow-hidden ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                        <div className={`absolute top-0 left-0 h-full rounded-full ${isDark ? 'bg-indigo-500' : 'bg-gray-800'}`} style={{ width: '72%' }}></div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className={`p-4 rounded-lg ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>Checked In</p>
                            <p className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>14,400</p>
                        </div>
                        <div className={`p-4 rounded-lg ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>Remaining</p>
                            <p className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>5,600</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Recent Orders Table */}
        <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
            <div className={`p-5 flex justify-between items-center`}>
                <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Recent Orders</h3>
                <button className={`text-sm font-normal flex items-center ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}>
                    View All <ChevronRight size={16} />
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className={`w-full text-left text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <thead className={`${isDark ? 'bg-[#252525] text-gray-500' : 'bg-gray-50 text-gray-400'} text-xs uppercase font-normal`}>
                        <tr>
                            <th className="px-6 py-3 font-medium">Order ID</th>
                            <th className="px-6 py-3 font-medium">Customer</th>
                            <th className="px-6 py-3 font-medium">Event</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 text-right font-medium">Amount</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-[#252525]' : 'divide-gray-50'}`}>
                        {MOCK_RECENT_ORDERS.map((order) => (
                            <tr key={order.id} className={`transition-colors ${isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-50'}`}>
                                <td className={`px-6 py-3.5 font-mono text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>#{order.id.split('_')[1]}</td>
                                <td className={`px-6 py-3.5 font-normal ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{order.customer}</td>
                                <td className={`px-6 py-3.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{order.event}</td>
                                <td className="px-6 py-3.5">
                                    <StatusBadge status={order.status} isDark={isDark} />
                                </td>
                                <td className={`px-6 py-3.5 text-right font-normal ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${order.amount.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

export default DashboardHome;
