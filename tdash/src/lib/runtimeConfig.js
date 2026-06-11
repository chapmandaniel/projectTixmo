const stripTrailingSlash = (value) => value.replace(/\/+$/, '');

const getRuntimeConfigValue = (key) => window.__TIXMO_CONFIG__?.[key] || '';

const getConfiguredUrl = (runtimeKey, envKey) => {
    const runtimeValue = getRuntimeConfigValue(runtimeKey);
    const envValue = import.meta.env[envKey] || '';
    const value = runtimeValue || envValue;

    return value ? stripTrailingSlash(value) : '';
};

export const getApiBaseUrl = () => {
    const runtimeValue = getRuntimeConfigValue('apiUrl');
    const configuredValue = runtimeValue || import.meta.env.VITE_API_URL || '/api/v1';
    return stripTrailingSlash(configuredValue);
};

export const getPolicyLinks = () => ({
    privacyPolicyUrl: getConfiguredUrl('privacyPolicyUrl', 'VITE_PRIVACY_POLICY_URL'),
    termsUrl: getConfiguredUrl('termsUrl', 'VITE_TERMS_URL'),
    refundPolicyUrl: getConfiguredUrl('refundPolicyUrl', 'VITE_REFUND_POLICY_URL'),
    organizerTermsUrl: getConfiguredUrl('organizerTermsUrl', 'VITE_ORGANIZER_TERMS_URL'),
});

export const getStripePublishableKey = () => (
    getRuntimeConfigValue('stripePublishableKey') || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
);

export const getPaymentCurrency = () => (
    getRuntimeConfigValue('paymentCurrency') || import.meta.env.VITE_PAYMENT_CURRENCY || 'usd'
);
