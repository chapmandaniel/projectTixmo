import React, { useState } from 'react';
import api from '../lib/api';
import { DashboardButton, DashboardSurface } from '../components/dashboard/DashboardPrimitives';
import { formatEventDate, DEFAULT_EVENT_TIMEZONE } from '../lib/eventTime';
import { Settings, Calendar, MapPin, Globe, Edit3, AlertTriangle } from 'lucide-react';

const ECC_Settings = ({ event, isDark, onEdit, user, onDeleted }) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const canDelete = ['OWNER', 'ADMIN'].includes(user?.role);
    const formatDate = (instant) => formatEventDate(instant, event.timezone || DEFAULT_EVENT_TIMEZONE);
    const deleteEvent = async () => {
        setDeleting(true);
        setError('');
        try {
            await api.delete(`/events/${event.id}`);
            onDeleted?.();
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to delete this event.');
        } finally { setDeleting(false); }
    };

    return (
        <div className="max-w-4xl space-y-8 animate-fade-in">

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className={`text-xl font-light tracking-tight mb-1 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Event Settings</h3>
                    <p className={`text-sm font-light tracking-wide ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>Manage configuration and details for this event.</p>
                </div>
            </div>

            {/* General Information Card */}
            <div className={`p-6 rounded-md border ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60' : 'bg-white border-gray-200/60 shadow-sm'}`}>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-2">
                        <div className={`p-2 rounded-md ${isDark ? 'bg-[#151521] text-pink-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <Settings size={20} />
                        </div>
                        <h4 className={`font-normal tracking-wide ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>General Information</h4>
                    </div>
                    <button
                        onClick={onEdit}
                        className={`px-4 py-2 text-sm font-light tracking-wide rounded-md border flex items-center transition-colors ${isDark
                            ? 'border-[#2b2b40]/60 hover:bg-[#232336] text-[#a1a5b7] hover:text-gray-200'
                            : 'border-gray-200/60 hover:bg-gray-50 text-gray-700'
                            }`}
                    >
                        <Edit3 size={16} className="mr-2" />
                        Edit Event
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <label className={`text-xs uppercase tracking-wider font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Event Name</label>
                        <p className={`text-lg font-light tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.name}</p>
                    </div>

                    <div className="space-y-1">
                        <label className={`text-xs uppercase tracking-wider font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Category</label>
                        <p className={`text-base font-light tracking-wide ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>{event.category || 'Uncategorized'}</p>
                    </div>

                    <div className="space-y-1">
                        <label className={`text-xs uppercase tracking-wider font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Date & Time</label>
                        <div className="flex items-center space-x-2">
                            <Calendar size={16} className={isDark ? 'text-[#a1a5b7]' : 'text-gray-500'} />
                            <p className={`text-base font-light tracking-wide ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                {formatDate(event.startDateTime || event.startDatetime)}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={`text-xs uppercase tracking-wider font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Location</label>
                        <div className="flex items-center space-x-2">
                            <MapPin size={16} className={isDark ? 'text-[#a1a5b7]' : 'text-gray-500'} />
                            <p className={`text-base font-light tracking-wide ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                {event.venue?.name || 'Venue TBA'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className={`mt-8 pt-6 border-t ${isDark ? 'border-[#2b2b40]/60' : 'border-gray-100'}`}>
                    <label className={`text-xs uppercase tracking-wider font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Description</label>
                    <p className={`mt-2 text-sm leading-relaxed font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-600'}`}>
                        {event.description || 'No description provided.'}
                    </p>
                </div>
            </div>

            {/* Visibility & Status */}
            <div className={`p-6 rounded-md border ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60' : 'bg-white border-gray-200/60 shadow-sm'}`}>
                <div className="flex items-center space-x-2 mb-6">
                    <div className={`p-2 rounded-md ${isDark ? 'bg-[#151521] text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                        <Globe size={20} />
                    </div>
                    <h4 className={`font-normal tracking-wide ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Visibility</h4>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className={`font-normal tracking-wide ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Event Status</p>
                        <p className={`text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                            Current status is <span className="font-normal text-gray-200">{event.status}</span>.
                            {['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(event.status) ? ' Your event is live and visible to the public.' : ' Your event is hidden.'}
                        </p>
                    </div>
                </div>
            </div>


            {canDelete && <DashboardSurface isDark={isDark} className="space-y-4 p-6">
                <h4 className="text-lg font-light">Delete event</h4>
                <p className="text-sm">Move an event without tickets to the recycle bin. An owner or administrator can restore it as a draft.</p>
                {error && <p role="alert">{error}</p>}
                {!confirmDelete ? <DashboardButton isDark={isDark} variant="danger" onClick={() => setConfirmDelete(true)}>Delete Event</DashboardButton> : <div role="dialog" aria-modal="false" aria-label="Confirm event deletion" className="space-y-4">
                    <p>Move “{event.name}” to the recycle bin?</p>
                    <div className="flex flex-wrap gap-3">
                        <DashboardButton isDark={isDark} variant="danger" disabled={deleting} onClick={deleteEvent}>{deleting ? 'Deleting…' : 'Confirm deletion'}</DashboardButton>
                        <DashboardButton isDark={isDark} variant="secondary" disabled={deleting} onClick={() => { setConfirmDelete(false); setError(''); }}>Keep event</DashboardButton>
                    </div>
                </div>}
            </DashboardSurface>}

        </div>
    );
};

export default ECC_Settings;
