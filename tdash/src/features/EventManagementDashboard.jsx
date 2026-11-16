import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import EventCommandCenter from './EventCommandCenter';
import api from '../lib/api';
import { extractIdFromSlug } from '../lib/utils';
import { DashboardButton, DashboardEmptyState, DashboardPage } from '../components/dashboard/DashboardPrimitives';

const EventManagementDashboard = ({ isDark, user }) => {
    const { eventId: urlEventId } = useParams();
    const eventId = extractIdFromSlug(urlEventId);
    const location = useLocation();
    const navigate = useNavigate();

    // Try to get event from router state first (fast transition), otherwise null
    const [eventData, setEventData] = useState(location.state?.event || null);
    const [isLoading, setIsLoading] = useState(!eventData);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        // If we don't have eventData (e.g., hard page reload), fetch it
        if (!eventData && eventId) {
            fetchEvent();
        }
    }, [eventId]);

    const fetchEvent = async () => {
        try {
            setIsLoading(true);
            setFetchError(null);
            const response = await api.get(`/events/${eventId}`);
            const event = response.data?.data || response.data?.event || response.data;
            if (event?.id) {
                setEventData(event);
            } else {
                navigate('/events'); // fallback
            }
        } catch (error) {
            console.error('Failed to fetch event', error);
            const status = error.response?.status;
            setFetchError(
                error.response?.data?.message
                || error.message
                || (status === 404 ? 'This event could not be found.' : 'Failed to load this event.')
            );
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (fetchError) {
        return (
            <DashboardPage className="mx-auto max-w-[1100px]">
                <div role="alert">
                    <DashboardEmptyState
                        isDark={isDark}
                        title="Unable to load event"
                        description={fetchError}
                        action={(
                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <DashboardButton isDark={isDark} onClick={fetchEvent}>
                                    Try again
                                </DashboardButton>
                                <DashboardButton isDark={isDark} variant="secondary" onClick={() => navigate('/events')}>
                                    Back to events
                                </DashboardButton>
                            </div>
                        )}
                    />
                </div>
            </DashboardPage>
        );
    }

    if (!eventData) return null;

    return (
        <EventCommandCenter
            event={eventData}
            onBack={() => navigate('/events')}
            isDark={isDark}
            user={user}
            onUpdate={(updatedEvent) => {
                if (updatedEvent?.id) {
                    setEventData(updatedEvent);
                } else {
                    fetchEvent();
                }
            }}
        />
    );
};

export default EventManagementDashboard;
