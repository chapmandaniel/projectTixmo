import React, { useState, useEffect } from 'react';
import { Plus, Filter, MapPin, Calendar, ChevronRight } from 'lucide-react';
import EventStudio from './EventStudio';
import StatusBadge from '../components/StatusBadge';
import api from '../lib/api';

const EventsView = ({ isDark, onManageEvent, user }) => {
    const [showWizard, setShowWizard] = useState(false);
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/events');
            // Backend returns { success: true, data: { events: [], pagination: {} } }
            if (response.data.data && response.data.data.events) {
                setEvents(response.data.data.events);
            }
        } catch (error) {
            console.error('Failed to fetch events', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateSuccess = () => {
        setShowWizard(false);
        fetchEvents();
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto relative">
            {showWizard && <EventStudio onClose={() => setShowWizard(false)} onSuccess={handleCreateSuccess} isDark={isDark} user={user} />}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className={`text-3xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Events</h2>
                    <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1 text-lg font-light`}>Manage your events, venues, and ticket allocations.</p>
                </div>
                <button
                    onClick={() => setShowWizard(true)}
                    className={`flex items-center space-x-2 px-4 py-2 text-sm font-normal rounded-lg transition-all shadow-lg ${isDark ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20' : 'bg-gray-800 text-white hover:bg-gray-700 shadow-gray-400/20'}`}
                >
                    <Plus size={16} />
                    <span>Create Event</span>
                </button>
            </div>

            {/* Clean Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
                <div className={`flex items-center p-1 rounded-md border overflow-x-auto ${isDark ? 'bg-[#151521] border-[#2b2b40]' : 'bg-gray-100 border-gray-200'}`}>
                    {
                        ['All Events', 'On Sale', 'Draft', 'Past', 'Cancelled'].map((filter, idx) => (
                            <button
                                key={filter}
                                className={`px-4 py-1.5 text-sm font-light rounded-sm whitespace-nowrap transition-all ${idx === 0
                                    ? (isDark ? 'bg-[#2b2b40] text-gray-100 shadow-sm' : 'bg-white text-gray-900 font-normal shadow-sm')
                                    : (isDark ? 'text-[#a1a5b7] hover:text-gray-300 hover:bg-[#1e1e2d]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200')
                                    }`}
                            >
                                {filter}
                            </button>
                        ))
                    }
                </div>
                <button className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border text-sm font-light transition-colors ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] text-[#a1a5b7] hover:text-gray-200 hover:bg-[#232336]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    <Filter size={14} />
                    <span>Filter</span>
                </button>
            </div>

            {/* Events Grid */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {events.length === 0 ? (
                        <div className={`col-span-2 text-center py-20 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            No events found. Create your first event!
                        </div>
                    ) : (
                        events.map((event) => (
                            <div
                                key={event.id}
                                onClick={() => onManageEvent(event)}
                                className={`relative rounded-md transition-all group p-6 flex flex-col h-full cursor-pointer border overflow-hidden ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] hover:bg-[#232336] hover:border-[#3a3a5a] shadow-lg shadow-black/20' : 'bg-white border-gray-200 hover:bg-gray-50 shadow-sm shadow-gray-200/50 hover:shadow-xl'}`}
                            >
                                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-pink-500 to-orange-400 opacity-70 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-700 blur-2xl bg-gradient-to-br from-pink-500 to-orange-400"></div>

                                <div className="flex justify-between items-start mb-4 z-10 transition-transform duration-300 group-hover:translate-x-1">
                                    <div>
                                        <span className={`text-xs font-medium tracking-wider uppercase mb-1 block ${isDark ? 'text-[#ff3366]' : 'text-pink-600'}`}>{event.category}</span>
                                        <h3 className={`text-xl font-light tracking-tight transition-colors ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{event.title || event.name}</h3>
                                    </div>
                                    <StatusBadge status={event.status} isDark={isDark} />
                                </div>

                                <div className={`grid grid-cols-2 gap-6 mb-6 text-sm font-light z-10 transition-transform duration-300 group-hover:translate-x-1 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                    <div className="flex items-center space-x-2">
                                        <MapPin size={16} className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                        <span>{event.venue?.name || 'TBA'}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Calendar size={16} className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                        <span>{event.startDateTime || event.startDatetime ? new Date(event.startDateTime || event.startDatetime).toLocaleDateString() : 'Date TBA'}</span>
                                    </div>
                                </div>

                                <div className="mt-auto space-y-4 z-10 transition-transform duration-300 group-hover:translate-x-1">
                                    <div>
                                        <div className="flex justify-between text-sm mb-2 font-light">
                                            <span className={isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}>Sales Progress</span>
                                            <span className={`font-normal ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{Math.round(((event.sold || 0) / (event.capacity || 100)) * 100)}%</span>
                                        </div>
                                        <div className={`w-full rounded-full h-1.5 ${isDark ? 'bg-[#151521]' : 'bg-gray-100'}`}>
                                            <div
                                                className="h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-400"
                                                style={{ width: `${((event.sold || 0) / (event.capacity || 100)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className={`flex items-center justify-between pt-4 border-t ${isDark ? 'border-[#2b2b40]' : 'border-gray-200'}`}>
                                        <div>
                                            <p className={`text-xs font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>Total Revenue</p>
                                            <p className={`text-xl font-light ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>${(event.revenue || 0).toLocaleString()}</p>
                                        </div>
                                        <button
                                            className={`text-sm font-light flex items-center px-4 py-2 rounded-md transition-colors border ${isDark ? 'bg-[#151521] border-[#2b2b40] text-[#a1a5b7] hover:bg-[#1e1e2d] hover:text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                                        >
                                            Manage Event <ChevronRight size={16} className="ml-1" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default EventsView;
