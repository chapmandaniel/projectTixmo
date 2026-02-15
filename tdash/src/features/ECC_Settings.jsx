import React from 'react';
import { Settings, Calendar, MapPin, Globe, Edit3, Trash2, AlertTriangle } from 'lucide-react';

const ECC_Settings = ({ event, isDark, onEdit }) => {

    const formatDate = (isoString) => {
        if (!isoString) return 'TBA';
        return new Date(isoString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="max-w-4xl space-y-8 animate-fade-in">

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className={`text-xl font-semibold mb-1 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Event Settings</h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Manage configuration and details for this event.</p>
                </div>
            </div>

            {/* General Information Card */}
            <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-2">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-[#252525]' : 'bg-indigo-50 text-indigo-600'}`}>
                            <Settings size={20} />
                        </div>
                        <h4 className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>General Information</h4>
                    </div>
                    <button
                        onClick={onEdit}
                        className={`px-4 py-2 text-sm font-medium rounded-lg border flex items-center transition-colors ${isDark
                            ? 'border-[#333] hover:bg-[#252525] text-gray-300'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                            }`}
                    >
                        <Edit3 size={16} className="mr-2" />
                        Edit Event
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <label className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Event Name</label>
                        <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.name}</p>
                    </div>

                    <div className="space-y-1">
                        <label className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Category</label>
                        <p className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>{event.category || 'Uncategorized'}</p>
                    </div>

                    <div className="space-y-1">
                        <label className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Date & Time</label>
                        <div className="flex items-center space-x-2">
                            <Calendar size={16} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                            <p className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                {formatDate(event.startDateTime)}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Location</label>
                        <div className="flex items-center space-x-2">
                            <MapPin size={16} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                            <p className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                {event.venue?.name || 'Venue TBA'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className={`mt-8 pt-6 border-t ${isDark ? 'border-[#333]' : 'border-gray-100'}`}>
                    <label className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Description</label>
                    <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {event.description || 'No description provided.'}
                    </p>
                </div>
            </div>

            {/* Visibility & Status */}
            <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex items-center space-x-2 mb-6">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-[#252525]' : 'bg-emerald-50 text-emerald-600'}`}>
                        <Globe size={20} />
                    </div>
                    <h4 className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Visibility</h4>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Event Status</p>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Current status is <span className="font-semibold">{event.status}</span>.
                            {event.status === 'PUBLISHED' ? ' Your event is live and visible to the public.' : ' Your event is hidden.'}
                        </p>
                    </div>
                </div>
            </div>


            {/* Danger Zone */}
            <div className={`p-6 rounded-2xl border border-red-200/50 ${isDark ? 'bg-red-900/5' : 'bg-red-50/50'}`}>
                <div className="flex items-center space-x-2 mb-6 text-rose-600">
                    <div className="p-2 rounded-lg bg-rose-100">
                        <AlertTriangle size={20} />
                    </div>
                    <h4 className="font-medium">Danger Zone</h4>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Delete Event</p>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Permanently delete this event and all associated data. This action cannot be undone.
                        </p>
                    </div>
                    <button
                        className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 shadow-lg shadow-rose-500/20 transition-all"
                        onClick={() => alert('Delete functionality not yet implemented safely.')}
                    >
                        Delete Event
                    </button>
                </div>
            </div>

        </div>
    );
};

export default ECC_Settings;
