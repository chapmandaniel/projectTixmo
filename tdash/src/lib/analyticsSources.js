const GOOGLE_ANALYTICS_PROPERTY_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_PROPERTY_ID || '';
const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID || '';

export const EVENT_GOOGLE_ANALYTICS_MEASUREMENT_ID_KEY = 'googleAnalyticsMeasurementId';
export const EVENT_GOOGLE_ANALYTICS_TAGS_KEY = 'googleAnalyticsTags';
export const EVENT_SELECTED_GOOGLE_ANALYTICS_TAG_ID_KEY = 'selectedGoogleAnalyticsTagId';

export const ANALYTICS_TIMEFRAMES = [
    { id: '7d', label: '7D', days: 7 },
    { id: '30d', label: '30D', days: 30 },
    { id: '90d', label: '90D', days: 90 },
];

export const GOOGLE_ANALYTICS_METRIC_BLUEPRINT = [
    'sessions',
    'totalUsers',
    'screenPageViews',
    'conversions',
    'purchaseRevenue',
];

export const GOOGLE_ANALYTICS_DIMENSION_BLUEPRINT = [
    'date',
    'sessionDefaultChannelGroup',
    'deviceCategory',
    'landingPagePlusQueryString',
    'city',
];

export const getGoogleAnalyticsIntegrationMeta = () => {
    const connected = Boolean(GOOGLE_ANALYTICS_PROPERTY_ID || GOOGLE_ANALYTICS_MEASUREMENT_ID);

    return {
        providerId: 'google-analytics',
        label: 'Google Analytics',
        propertyId: GOOGLE_ANALYTICS_PROPERTY_ID,
        measurementId: GOOGLE_ANALYTICS_MEASUREMENT_ID,
        connected,
        statusLabel: connected ? 'Connection details detected' : 'Awaiting property connection',
        statusTone: connected ? 'ready' : 'pending',
    };
};

export const getEventGoogleAnalyticsMeasurementId = (event) => {
    const directValue = event?.googleAnalyticsMeasurementId;
    const metadataValue = event?.metadata?.[EVENT_GOOGLE_ANALYTICS_MEASUREMENT_ID_KEY];
    const measurementId = directValue || metadataValue || '';

    return typeof measurementId === 'string' ? measurementId.trim() : '';
};

export const normalizeEventGoogleAnalyticsTags = (event) => {
    const metadataTags = event?.metadata?.[EVENT_GOOGLE_ANALYTICS_TAGS_KEY];
    const normalizedTags = Array.isArray(metadataTags)
        ? metadataTags
            .map((tag, index) => ({
                id: typeof tag?.id === 'string' && tag.id ? tag.id : `tag-${index + 1}`,
                title: typeof tag?.title === 'string' && tag.title.trim() ? tag.title.trim() : `GA tag ${index + 1}`,
                measurementId: typeof tag?.measurementId === 'string' ? tag.measurementId.trim() : '',
            }))
            .filter((tag) => tag.title || tag.measurementId)
        : [];

    if (normalizedTags.length > 0) {
        return normalizedTags;
    }

    const legacyMeasurementId = getEventGoogleAnalyticsMeasurementId(event);
    return legacyMeasurementId
        ? [{ id: 'primary', title: 'Primary tag', measurementId: legacyMeasurementId }]
        : [];
};

export const getSelectedEventGoogleAnalyticsTag = (event) => {
    const tags = normalizeEventGoogleAnalyticsTags(event);
    const selectedTagId = event?.metadata?.[EVENT_SELECTED_GOOGLE_ANALYTICS_TAG_ID_KEY];

    return tags.find((tag) => tag.id === selectedTagId) || tags[0] || null;
};

export const getEventGoogleAnalyticsIntegrationMeta = (event) => {
    const baseMeta = getGoogleAnalyticsIntegrationMeta();
    const eventTag = getSelectedEventGoogleAnalyticsTag(event);
    const eventMeasurementId = eventTag?.measurementId || getEventGoogleAnalyticsMeasurementId(event);

    if (!event) {
        return baseMeta;
    }

    const connected = Boolean(eventMeasurementId || baseMeta.propertyId);

    return {
        ...baseMeta,
        measurementId: eventMeasurementId || baseMeta.measurementId,
        eventMeasurementId,
        tagTitle: eventTag?.title || '',
        connected,
        statusLabel: connected ? 'Event GA details detected' : 'Event GA ID needed',
        statusTone: connected ? 'ready' : 'pending',
    };
};

export const buildAnalyticsQueryString = (timeframeId, eventId = 'all') => {
    const timeframe = ANALYTICS_TIMEFRAMES.find((item) => item.id === timeframeId) || ANALYTICS_TIMEFRAMES[1];
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (timeframe.days - 1));

    const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
    });

    if (eventId && eventId !== 'all') {
        params.set('eventId', eventId);
    }

    return `?${params.toString()}`;
};
