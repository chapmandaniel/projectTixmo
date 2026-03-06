import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import EventCommandCenter from './EventCommandCenter';
import api from '../lib/api';
import { extractIdFromSlug } from '../lib/utils';

const EventManagementDashboard = ({ isDark, user }) => {
    const { eventId: urlEventId } = useParams();
    const eventId = extractIdFromSlug(urlEventId);
    const location = useLocation();
    const navigate = useNavigate();

    // Try to get event from router state first (fast transition), otherwise null
    const [eventData, setEventData] = useState(location.state?.event || null);
    const [isLoading, setIsLoading] = useState(!eventData);

    useEffect(() => {
        // If we don't have eventData (e.g., hard page reload), fetch it
        if (!eventData && eventId) {
            fetchEvent();
        }
    }, [eventId]);

    const fetchEvent = async () => {
        try {
            setIsLoading(true);
            const response = await api.get(`/events/${eventId}`);
            if (response.data && response.data.event) {
                setEventData(response.data.event);
            } else {
                navigate('/events'); // fallback
            }
        } catch (error) {
            console.error('Failed to fetch event', error);
            navigate('/events');
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

    if (!eventData) return null;

    return (
        <EventCommandCenter
            event={eventData}
            onBack={() => navigate('/events')}
            isDark={isDark}
            user={user}
            onUpdate={(updatedEvent) => {
                setEventData(updatedEvent);
            }}
        />
    );
};

export default EventManagementDashboard;
