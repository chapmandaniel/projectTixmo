import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUp, ArrowDown, DollarSign, Ticket, Users, Activity, Clock } from 'lucide-react';
import { MOCK_ANALYTICS_DATA } from '../data/mockData';

const StatCard = ({ title, value, trend, trendUp, icon: Icon, isDark }) => (
    <div className={`p-6 rounded-2xl border transition-all ${isDark ? 'bg-[#1e1e1e] border-[#333] hover:border-[#444]' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'}`}>
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-[#252525] text-gray-300' : 'bg-indigo-50 text-indigo-600'}`}>
                <Icon size={24} />
            </div>
            {trend && (
                <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {trendUp ? <ArrowUp size={12} className="mr-1" /> : <ArrowDown size={12} className="mr-1" />}
                    {trend}
                </div>
            )}
        </div>
        <h3 className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</h3>
        <p className={`text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
);

const ActivityItem = ({ title, time, type, isDark }) => (
    <div className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-50'}`}>
        <div className={`mt-1 w-2 h-2 rounded-full ${type === 'sale' ? 'bg-emerald-500' : type === 'checkin' ? 'bg-indigo-500' : 'bg-amber-500'}`}></div>
        <div className="flex-1">
            <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{title}</p>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{time}</p>
        </div>
    </div>
);

const CustomTooltip = ({ active, payload, label, isDark }) => {
    if (active && payload && payload.length) {
        return (
            <div className={`p-3 rounded-lg border shadow-lg ${isDark ? 'bg-[#1e1e1e] border-[#333] text-gray-200' : 'bg-white border-gray-100 text-gray-700'}`}>
                <p className="text-sm font-medium mb-2">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center space-x-2 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                        <span className="capitalize">{entry.name}:</span>
                        <span className="font-semibold">
                            {entry.name === 'revenue' ? '$' : ''}{entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const ECC_Overview = ({ event, isDark }) => {
    // State for activity feed
    const [loading, setLoading] = React.useState(true);
    const [recentActivity, setRecentActivity] = React.useState([]);

    // Fallback data
    const revenue = event.revenue || 0;
    const sold = event.sold || 0;
    const capacity = event.capacity || 100;
    const percentSold = Math.round((sold / capacity) * 100);

    // Simulate fetching live activity
    React.useEffect(() => {
        let mounted = true;
        const fetchActivity = async () => {
            // In a real app, this would be: const res = await api.get(`/events/${event.id}/activity`);
            // For now, we'll simulate a delay and use mock data or empty state
            setTimeout(() => {
                if (mounted) {
                    setRecentActivity([
                        { id: 1, user: 'Alex M.', details: 'VIP Ticket', amount: 150.00, time: new Date().toISOString(), type: 'sale' },
                        { id: 2, user: 'Sarah K.', details: 'General Admission', amount: 45.00, time: new Date(Date.now() - 1000 * 60 * 5).toISOString(), type: 'sale' },
                        { id: 3, user: 'Mike R.', details: 'Checked In', amount: 0, time: new Date(Date.now() - 1000 * 60 * 15).toISOString(), type: 'checkin' },
                        { id: 4, user: 'Emily W.', details: 'General Admission', amount: 45.00, time: new Date(Date.now() - 1000 * 60 * 30).toISOString(), type: 'sale' },
                    ]);
                    setLoading(false);
                }
            }, 800);
        };
        fetchActivity();
        return () => { mounted = false; };
    }, [event.id]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Revenue"
                    value={`$${revenue.toLocaleString()}`}
                    trend="12% vs last week"
                    trendUp={true}
                    icon={DollarSign}
                    isDark={isDark}
                />
                <StatCard
                    title="Tickets Sold"
                    value={`${sold.toLocaleString()} / ${capacity.toLocaleString()}`}
                    trend={`${percentSold}% sold`}
                    trendUp={true}
                    icon={Ticket}
                    isDark={isDark}
                />
                <StatCard
                    title="Page Views"
                    value="12.5k"
                    trend="5% vs last week"
                    trendUp={true}
                    icon={Users}
                    isDark={isDark}
                />
                <StatCard
                    title="Conversion Rate"
                    value="4.2%"
                    trend="1.1% vs last week"
                    trendUp={false}
                    icon={Activity}
                    isDark={isDark}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">

                {/* Sales Chart (2/3 width) */}
                <div className={`col-span-2 p-6 rounded-2xl border ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Sales Velocity</h3>
                        <select className={`text-sm bg-transparent outline-none border rounded-lg px-2 py-1 ${isDark ? 'border-[#333] text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                            <option>Last 7 Days</option>
                            <option>Last 30 Days</option>
                        </select>
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={MOCK_ANALYTICS_DATA}>
                                <defs>
                                    <linearGradient id="colorSalesECC" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2a2a2a' : '#f3f4f6'} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#525252' : '#9ca3af', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#525252' : '#9ca3af', fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip isDark={isDark} />} />
                                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenueECC)" />
                                <Area type="monotone" dataKey="sales" stroke="#82ca9d" strokeWidth={3} fillOpacity={1} fill="url(#colorSalesECC)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Feed (1/3 width) */}
                <div className={`col-span-1 p-6 rounded-2xl border flex flex-col ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Live Activity</h3>
                        <div className={`p-1.5 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 text-emerald-600'}`}>
                            <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center space-x-3 opacity-50">
                                        <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-[#252525]' : 'bg-gray-100'}`}></div>
                                        <div className="space-y-1">
                                            <div className={`h-3 w-32 rounded ${isDark ? 'bg-[#252525]' : 'bg-gray-100'}`}></div>
                                            <div className={`h-2 w-20 rounded ${isDark ? 'bg-[#252525]' : 'bg-gray-100'}`}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : recentActivity.length === 0 ? (
                            <div className={`text-center py-6 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                No recent activity
                            </div>
                        ) : (
                            recentActivity.map(activity => (
                                <ActivityItem
                                    key={activity.id}
                                    title={
                                        <span>
                                            <span className="font-medium">{activity.user}</span> purchased {activity.details} for ${Number(activity.amount).toFixed(2)}
                                        </span>
                                    }
                                    time={new Date(activity.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    type={activity.type}
                                    isDark={isDark}
                                />
                            ))
                        )}
                    </div>

                    <button className={`w-full mt-4 py-2 text-sm font-medium rounded-lg border border-dashed transition-colors ${isDark ? 'border-[#333] text-gray-400 hover:text-white hover:border-gray-500' : 'border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}>
                        View All Activity
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ECC_Overview;
