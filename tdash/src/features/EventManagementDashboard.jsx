import React, { useState } from 'react';
import EventCommandCenter from './EventCommandCenter';
import api from '../lib/api';

const EventManagementDashboard = ({ event, onBack, isDark, user, onUpdate }) => {
    // We can keep the container simple now, as EventCommandCenter handles the layout.
    // However, if we need to fetch data *before* rendering ECC, we can do it here.
    // For now, we just pass the event data through.

    // Local state for event data in case it updates
    const [eventData, setEventData] = useState(event);

    React.useEffect(() => {
        setEventData(event);
    }, [event]);

    return (
        <EventCommandCenter
            event={eventData}
            onBack={onBack}
            isDark={isDark}
            user={user}
            onUpdate={(updatedEvent) => {
                setEventData(updatedEvent);
                if (onUpdate) onUpdate(updatedEvent);
            }}
        />
    );
};

export default EventManagementDashboard;
