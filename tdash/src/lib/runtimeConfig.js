const stripTrailingSlash = (value) => value.replace(/\/+$/, '');

export const getApiBaseUrl = () => {
    const runtimeValue = window.__TIXMO_CONFIG__?.apiUrl;
    const configuredValue = runtimeValue || import.meta.env.VITE_API_URL || '/api/v1';
    return stripTrailingSlash(configuredValue);
};
