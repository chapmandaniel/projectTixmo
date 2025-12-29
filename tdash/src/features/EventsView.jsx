import React, { useState, useEffect } from 'react';
import { Plus, Filter, MapPin, Calendar, ChevronRight } from 'lucide-react';
import EventWizard from './EventWizard';
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
            {showWizard && <EventWizard onClose={() => setShowWizard(false)} onSuccess={handleCreateSuccess} isDark={isDark} user={user} />}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Events</h2>
                    <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm`}>Manage your events, venues, and ticket allocations.</p>
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
            <div className={`flex items-center space-x-2 pb-2 border-b overflow-x-auto ${isDark ? 'border-[#2a2a2a]' : 'border-gray-200'}`}>
                {
                    ['All Events', 'On Sale', 'Draft', 'Past', 'Cancelled'].map((filter, idx) => (
                        <button
                            key={filter}
                            className={`px-4 py-2 text-sm font-normal transition-colors relative ${idx === 0
                                ? (isDark ? 'text-gray-200' : 'text-gray-700 font-medium')
                                : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')
                                }`}
                        >
                            {filter}
                            {idx === 0 && <div className={`absolute bottom-[-9px] left-0 w-full h-0.5 ${isDark ? 'bg-indigo-500' : 'bg-gray-800'}`}></div>}
                        </button>
                    ))
                }
                <div className="flex-1"></div>
                <button className={`p-2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                    <Filter size={16} />
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
                                className={`rounded-xl transition-all group p-5 flex flex-col h-full cursor-pointer ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20 hover:bg-[#252525]' : 'bg-white shadow-sm shadow-gray-200/50 hover:shadow-md'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className={`text-xs font-medium tracking-wider uppercase mb-1 block ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{event.category}</span>
                                        <h3 className={`text-lg font-medium transition-colors ${isDark ? 'text-gray-200 group-hover:text-indigo-400' : 'text-gray-700 group-hover:text-indigo-600'}`}>{event.title || event.name}</h3>
                                    </div>
                                    <StatusBadge status={event.status} isDark={isDark} />
                                </div>

                                <div className={`grid grid-cols-2 gap-6 mb-6 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    <div className="flex items-center space-x-2">
                                        <MapPin size={16} />
                                        <span>{event.venue?.name || 'TBA'}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Calendar size={16} />
                                        <span>{event.startDateTime || event.startDatetime ? new Date(event.startDateTime || event.startDatetime).toLocaleDateString() : 'Date TBA'}</span>
                                    </div>
                                </div>

                                <div className="mt-auto space-y-4">
                                    <div>
                                        {/* Mocked sales data for now as API might not return it in list view */}
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>Sales Progress</span>
                                            <span className={`font-normal ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{Math.round(((event.sold || 0) / (event.capacity || 100)) * 100)}%</span>
                                        </div>
                                        <div className={`w-full rounded-full h-1.5 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                                            <div
                                                className={`h-1.5 rounded-full ${isDark ? 'bg-indigo-500' : 'bg-gray-700'}`}
                                                style={{ width: `${((event.sold || 0) / (event.capacity || 100)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className={`flex items-center justify-between pt-4 border-t ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                                        <div>
                                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Total Revenue</p>
                                            <p className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>${(event.revenue || 0).toLocaleString()}</p>
                                        </div>
                                        <div
                                            className={`text-sm font-medium flex items-center transition-colors ${isDark ? 'text-gray-400 hover:text-indigo-400' : 'text-gray-500 hover:text-indigo-600'}`}
                                        >
                                            Manage Event <ChevronRight size={16} className="ml-1" />
                                        </div>
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
