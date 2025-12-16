import React, { useState } from 'react';
import {
    ArrowLeft, Edit3, Download, Calendar, MapPin, Plus, MoreHorizontal, Search, Filter, UserCheck, UserX
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { MOCK_ANALYTICS_DATA, MOCK_TICKET_TYPES, MOCK_GUESTS, COLORS, DARK_COLORS } from '../data/mockData';

const EventManagementDashboard = ({ event, onBack, isDark }) => {
    const [activeTab, setActiveTab] = useState('overview');

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'tickets', label: 'Ticket Types' },
        { id: 'guests', label: 'Guest List' },
        { id: 'settings', label: 'Settings' },
    ];

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col space-y-4">
                <button
                    onClick={onBack}
                    className={`flex items-center space-x-2 text-sm ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                >
                    <ArrowLeft size={16} />
                    <span>Back to Events</span>
                </button>

                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center space-x-3 mb-1">
                            <h1 className={`text-2xl font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{event.name}</h1>
                            <StatusBadge status={event.status} isDark={isDark} />
                        </div>
                        <div className={`flex items-center space-x-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            <span className="flex items-center"><Calendar size={14} className="mr-1.5" /> {new Date(event.startDatetime).toLocaleDateString()}</span>
                            <span className="flex items-center"><MapPin size={14} className="mr-1.5" /> {event.venue}</span>
                        </div>
                    </div>
                    <div className="flex space-x-3">
                        <button className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center transition-colors ${isDark ? 'bg-[#252525] text-gray-300 hover:bg-[#2a2a2a]' : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'}`}>
                            <Edit3 size={16} className="mr-2" /> Edit
                        </button>
                        <button className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center shadow-lg ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}`}>
                            <Download size={16} className="mr-2" /> Export
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className={`flex items-center space-x-6 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-200'}`}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-3 text-sm font-medium relative transition-colors ${activeTab === tab.id
                                    ? (isDark ? 'text-white' : 'text-indigo-600')
                                    : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-800')
                                }`}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className={`absolute bottom-0 left-0 w-full h-0.5 ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'}`}></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <StatCard
                                title="Total Revenue"
                                value={`$${event.revenue.toLocaleString()}`}
                                trend="15% vs last week"
                                trendUp={true}
                                isDark={isDark}
                            />
                            <div className={`${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'} p-5 rounded-xl`}>
                                <h3 className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm font-normal mb-3`}>Tickets Sold</h3>
                                <div className="flex items-end justify-between mb-2">
                                    <p className={`${isDark ? 'text-gray-200' : 'text-gray-700'} text-3xl font-medium tracking-tight`}>{event.sold.toLocaleString()}</p>
                                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>of {event.capacity.toLocaleString()}</span>
                                </div>
                                <div className={`w-full rounded-full h-1.5 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                                    <div
                                        className={`h-1.5 rounded-full ${isDark ? 'bg-emerald-500' : 'bg-emerald-600'}`}
                                        style={{ width: `${(event.sold / event.capacity) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            <StatCard
                                title="Page Views"
                                value="45.2k"
                                trend="5.2% vs last week"
                                trendUp={true}
                                isDark={isDark}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div className={`${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'} p-5 rounded-xl`}>
                                <h3 className={`text-lg font-medium mb-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Sales Velocity</h3>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={MOCK_ANALYTICS_DATA}>
                                            <defs>
                                                <linearGradient id="colorSalesM" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={isDark ? '#6366f1' : '#374151'} stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor={isDark ? '#6366f1' : '#374151'} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2a2a2a' : '#f3f4f6'} />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#525252' : '#9ca3af', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#525252' : '#9ca3af', fontSize: 12 }} />
                                            <Tooltip contentStyle={{ backgroundColor: isDark ? '#252525' : '#fff', borderRadius: '8px', border: 'none' }} />
                                            <Area type="monotone" dataKey="sales" stroke={isDark ? '#6366f1' : '#374151'} strokeWidth={2} fillOpacity={1} fill="url(#colorSalesM)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={`${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'} p-5 rounded-xl`}>
                                <h3 className={`text-lg font-medium mb-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Sales by Type</h3>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={MOCK_TICKET_TYPES.map(t => ({ name: t.name, value: t.sold }))}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {MOCK_TICKET_TYPES.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={isDark ? DARK_COLORS[index % DARK_COLORS.length] : COLORS[index % COLORS.length]} strokeWidth={0} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: isDark ? '#252525' : '#fff', borderRadius: '8px', border: 'none' }} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'tickets' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-end">
                            <button className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center shadow-lg ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}`}>
                                <Plus size={16} className="mr-2" /> Add Ticket Type
                            </button>
                        </div>
                        <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
                            <div className="overflow-x-auto">
                                <table className={`w-full text-left text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <thead className={`${isDark ? 'bg-[#252525] text-gray-500' : 'bg-gray-50 text-gray-400'} text-xs uppercase font-normal`}>
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Name</th>
                                            <th className="px-6 py-3 font-medium">Price</th>
                                            <th className="px-6 py-3 font-medium">Sold / Total</th>
                                            <th className="px-6 py-3 font-medium">Status</th>
                                            <th className="px-6 py-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${isDark ? 'divide-[#252525]' : 'divide-gray-50'}`}>
                                        {MOCK_TICKET_TYPES.map((ticket) => (
                                            <tr key={ticket.id} className={`transition-colors ${isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-50'}`}>
                                                <td className={`px-6 py-4 font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{ticket.name}</td>
                                                <td className="px-6 py-4">${ticket.price.toFixed(2)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-2">
                                                        <div className={`w-24 h-1.5 rounded-full ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                                                            <div className={`h-1.5 rounded-full ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'}`} style={{ width: `${(ticket.sold / ticket.total) * 100}%` }}></div>
                                                        </div>
                                                        <span className="text-xs">{ticket.sold} / {ticket.total}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <StatusBadge status={ticket.status} isDark={isDark} />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`}>
                                                        <MoreHorizontal size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'guests' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <div className={`flex items-center px-3 py-2 rounded-lg border ${isDark ? 'bg-[#252525] border-[#333]' : 'bg-white border-gray-200'}`}>
                                <Search size={16} className={`mr-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                <input
                                    type="text"
                                    placeholder="Search guests..."
                                    className={`bg-transparent outline-none text-sm ${isDark ? 'text-gray-200 placeholder-gray-600' : 'text-gray-800 placeholder-gray-400'}`}
                                />
                            </div>
                            <button className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center transition-colors ${isDark ? 'bg-[#252525] text-gray-300 hover:bg-[#2a2a2a]' : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'}`}>
                                <Filter size={16} className="mr-2" /> Filter
                            </button>
                        </div>
                        <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
                            <div className="overflow-x-auto">
                                <table className={`w-full text-left text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <thead className={`${isDark ? 'bg-[#252525] text-gray-500' : 'bg-gray-50 text-gray-400'} text-xs uppercase font-normal`}>
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Name</th>
                                            <th className="px-6 py-3 font-medium">Ticket Type</th>
                                            <th className="px-6 py-3 font-medium">Status</th>
                                            <th className="px-6 py-3 font-medium">Check-in Time</th>
                                            <th className="px-6 py-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${isDark ? 'divide-[#252525]' : 'divide-gray-50'}`}>
                                        {MOCK_GUESTS.map((guest) => (
                                            <tr key={guest.id} className={`transition-colors ${isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-50'}`}>
                                                <td className={`px-6 py-4 font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{guest.name}</td>
                                                <td className="px-6 py-4">{guest.type}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${guest.status === 'Checked In' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700') : (isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600')}`}>
                                                        {guest.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{guest.time}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end space-x-2">
                                                        <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400' : 'hover:bg-emerald-50 text-gray-400 hover:text-emerald-600'}`} title="Check In">
                                                            <UserCheck size={16} />
                                                        </button>
                                                        <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-rose-500/10 text-gray-500 hover:text-rose-400' : 'hover:bg-rose-50 text-gray-400 hover:text-rose-600'}`} title="Revoke">
                                                            <UserX size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="flex items-center justify-center h-[300px]">
                        <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Event settings form would go here (reuse wizard components)</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventManagementDashboard;
