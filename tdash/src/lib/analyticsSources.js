const GOOGLE_ANALYTICS_PROPERTY_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_PROPERTY_ID || '';
const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID || '';

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

export const buildAnalyticsQueryString = (timeframeId) => {
    const timeframe = ANALYTICS_TIMEFRAMES.find((item) => item.id === timeframeId) || ANALYTICS_TIMEFRAMES[1];
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (timeframe.days - 1));

    const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
    });

    return `?${params.toString()}`;
};
