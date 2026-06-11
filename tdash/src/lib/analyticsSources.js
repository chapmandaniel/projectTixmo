const GOOGLE_ANALYTICS_PROPERTY_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_PROPERTY_ID || '';
const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID || '';

export const ORGANIZATION_GOOGLE_ANALYTICS_TAGS_KEY = 'googleAnalyticsTags';
export const ORGANIZATION_SELECTED_GOOGLE_ANALYTICS_TAG_ID_KEY = 'selectedGoogleAnalyticsTagId';

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

export const normalizeOrganizationGoogleAnalyticsTags = (organization) => {
    const settingsTags = organization?.settings?.[ORGANIZATION_GOOGLE_ANALYTICS_TAGS_KEY];

    return Array.isArray(settingsTags)
        ? settingsTags
            .map((tag, index) => ({
                id: typeof tag?.id === 'string' && tag.id ? tag.id : `tag-${index + 1}`,
                title: typeof tag?.title === 'string' && tag.title.trim() ? tag.title.trim() : `GA tag ${index + 1}`,
                measurementId: typeof tag?.measurementId === 'string' ? tag.measurementId.trim() : '',
            }))
            .filter((tag) => tag.title || tag.measurementId)
        : [];
};

export const getSelectedOrganizationGoogleAnalyticsTag = (organization) => {
    const tags = normalizeOrganizationGoogleAnalyticsTags(organization);
    const selectedTagId = organization?.settings?.[ORGANIZATION_SELECTED_GOOGLE_ANALYTICS_TAG_ID_KEY];

    return tags.find((tag) => tag.id === selectedTagId) || tags[0] || null;
};

export const getOrganizationGoogleAnalyticsIntegrationMeta = (organization, selectedTag) => {
    const baseMeta = getGoogleAnalyticsIntegrationMeta();
    const organizationTag = selectedTag || getSelectedOrganizationGoogleAnalyticsTag(organization);
    const measurementId = organizationTag?.measurementId || baseMeta.measurementId;
    const connected = Boolean(measurementId || baseMeta.propertyId);

    return {
        ...baseMeta,
        measurementId,
        organizationMeasurementId: organizationTag?.measurementId || '',
        tagTitle: organizationTag?.title || '',
        connected,
        statusLabel: connected ? 'GA tag selected' : 'GA tag needed',
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
