import React, { useEffect, useState } from 'react';
import { Settings, Calendar, MapPin, Globe, Edit3, AlertTriangle, BarChart3, CheckCircle2, Loader2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    DashboardButton,
    DashboardChip,
    DashboardSurface,
    DashboardTextInput,
} from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';
import { getEventGoogleAnalyticsMeasurementId } from '../lib/analyticsSources';
import { cn } from '../lib/utils';
import api from '../lib/api';

const ECC_Settings = ({ event, isDark, onEdit, onUpdate }) => {
    const navigate = useNavigate();
    const uiTheme = getDashboardTheme(isDark);
    const [googleAnalyticsMeasurementId, setGoogleAnalyticsMeasurementId] = useState(() => getEventGoogleAnalyticsMeasurementId(event));
    const [isSavingAnalytics, setIsSavingAnalytics] = useState(false);
    const [analyticsMessage, setAnalyticsMessage] = useState('');

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

    useEffect(() => {
        setGoogleAnalyticsMeasurementId(getEventGoogleAnalyticsMeasurementId(event));
    }, [event]);

    const handleSaveAnalytics = async () => {
        setIsSavingAnalytics(true);
        setAnalyticsMessage('');

        try {
            const response = await api.put(`/events/${event.id}`, {
                googleAnalyticsMeasurementId,
            });
            const updatedEvent = response.data?.data || response.data?.event || response.data;

            setGoogleAnalyticsMeasurementId(getEventGoogleAnalyticsMeasurementId(updatedEvent));
            setAnalyticsMessage('Analytics ID saved.');

            if (onUpdate && updatedEvent?.id) {
                onUpdate(updatedEvent);
            }
        } catch (error) {
            console.error('Failed to save Google Analytics ID', error);
            setAnalyticsMessage(error.response?.data?.message || 'Could not save the analytics ID.');
        } finally {
            setIsSavingAnalytics(false);
        }
    };

    const openAnalyticsForEvent = () => {
        navigate(`/analytics?eventId=${event.id}`);
    };

    const hasAnalyticsId = Boolean(googleAnalyticsMeasurementId.trim());

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

            <DashboardSurface isDark={isDark} accent="blue" className="p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className={cn('rounded-md p-2', isDark ? 'bg-dashboard-shell text-cyan-300' : 'bg-sky-50 text-sky-700')}>
                                <BarChart3 size={20} />
                            </div>
                            <h4 className={cn('font-normal tracking-wide', uiTheme.textPrimary)}>Google Analytics</h4>
                        </div>
                        <p className={cn('mt-3 max-w-2xl text-sm font-light leading-6', uiTheme.textSecondary)}>
                            Attach this event to its GA stream so the Analytics dashboard can show the configured source when this event is selected.
                        </p>
                    </div>
                    <DashboardChip
                        isDark={isDark}
                        className={cn(
                            'gap-2 border',
                            hasAnalyticsId
                                ? (isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700')
                                : (isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700')
                        )}
                    >
                        <CheckCircle2 size={14} />
                        {hasAnalyticsId ? 'Configured' : 'Not set'}
                    </DashboardChip>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <label className="block">
                        <span className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>GA measurement ID</span>
                        <DashboardTextInput
                            isDark={isDark}
                            className="mt-2"
                            placeholder="G-XXXXXXXXXX"
                            value={googleAnalyticsMeasurementId}
                            onChange={(inputEvent) => {
                                setGoogleAnalyticsMeasurementId(inputEvent.target.value);
                                setAnalyticsMessage('');
                            }}
                        />
                    </label>
                    <div className="flex flex-wrap gap-3">
                        <DashboardButton
                            isDark={isDark}
                            variant="secondary"
                            onClick={openAnalyticsForEvent}
                        >
                            <BarChart3 size={16} />
                            View Analytics
                        </DashboardButton>
                        <DashboardButton
                            isDark={isDark}
                            onClick={handleSaveAnalytics}
                            disabled={isSavingAnalytics}
                        >
                            {isSavingAnalytics ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save ID
                        </DashboardButton>
                    </div>
                </div>

                {analyticsMessage ? (
                    <p className={cn('mt-3 text-sm font-light', analyticsMessage.includes('saved') ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-rose-300' : 'text-rose-700'))}>
                        {analyticsMessage}
                    </p>
                ) : null}
            </DashboardSurface>

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
                            {event.status === 'PUBLISHED' ? ' Your event is live and visible to the public.' : ' Your event is hidden.'}
                        </p>
                    </div>
                </div>
            </div>


            {/* Danger Zone */}
            <div className={`p-6 rounded-md border ${isDark ? 'bg-rose-900/10 border-rose-900/30' : 'bg-red-50/50 border-red-200/50'}`}>
                <div className={`flex items-center space-x-2 mb-6 ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                    <div className={`p-2 rounded-md ${isDark ? 'bg-rose-900/20' : 'bg-rose-100'}`}>
                        <AlertTriangle size={20} />
                    </div>
                    <h4 className="font-normal tracking-wide">Danger Zone</h4>
                </div>

                <div className="flex md:flex-row flex-col items-start md:items-center justify-between gap-4">
                    <div>
                        <p className={`font-normal tracking-wide ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Delete Event</p>
                        <p className={`text-sm font-light ${isDark ? 'text-rose-200/50' : 'text-gray-500'}`}>
                            Permanently delete this event and all associated data. This action cannot be undone.
                        </p>
                    </div>
                    <button
                        className="px-4 py-2 bg-rose-600/90 hover:bg-rose-600 text-white text-sm font-light tracking-wide rounded-md transition-all shadow-lg shadow-rose-900/20"
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
