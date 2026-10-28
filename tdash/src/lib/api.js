import axios from 'axios';
import { getApiBaseUrl } from './runtimeConfig';
import {
    clearStoredSession,
    emitAuthExpired,
    getAccessToken,
    getRefreshToken,
    getSessionGeneration,
    updateStoredTokens,
} from './session';

const axiosInstance = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

const refreshClient = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

let refreshRequest = null;
let refreshingToken = null;

const sessionChangedError = () => Object.assign(new Error('Session changed'), { sessionChanged: true });

const isAuthRoute = (url = '') => (
    ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/accept-invitation']
        .some((route) => url.includes(route))
);

const refreshAccessToken = async () => {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
        throw new Error('Missing refresh token');
    }

    const generation = getSessionGeneration();
    if (!refreshRequest || refreshingToken !== refreshToken) {
        refreshingToken = refreshToken;
        const request = refreshClient
            .post('/auth/refresh', { refreshToken })
            .then((response) => {
                if (generation !== getSessionGeneration() || refreshToken !== getRefreshToken()) {
                    throw sessionChangedError();
                }
                const tokens = response.data?.data || {};
                updateStoredTokens(tokens);
                return tokens;
            })
            .finally(() => {
                if (refreshRequest === request) {
                    refreshRequest = null;
                    refreshingToken = null;
                }
            });
        refreshRequest = request;
    }

    return refreshRequest;
};

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
    (config) => {
        config._sessionGeneration ??= getSessionGeneration();
        if (config._sessionGeneration !== getSessionGeneration()) throw sessionChangedError();
        const token = getAccessToken();
        if (token && !config.headers.has('Authorization')) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle auth errors (401)
axiosInstance.interceptors.response.use(
    (response) => {
        if (response.config._sessionGeneration !== getSessionGeneration()) throw sessionChangedError();
        return response;
    },
    async (error) => {
        const status = error.response?.status;
        const originalRequest = error.config;

        if (error.sessionChanged || (originalRequest && originalRequest._sessionGeneration !== getSessionGeneration())) {
            return Promise.reject(sessionChangedError());
        }

        if (status === 401) {
            if (!originalRequest || isAuthRoute(originalRequest.url)) {
                return Promise.reject(error);
            }

            if (originalRequest._retry) {
                clearStoredSession();
                emitAuthExpired();
                return Promise.reject(error);
            }

            try {
                originalRequest._retry = true;

                const { accessToken } = await refreshAccessToken();
                originalRequest.headers = {
                    ...originalRequest.headers,
                    Authorization: `Bearer ${accessToken}`,
                };

                return axiosInstance(originalRequest);
            } catch (refreshError) {
                if (refreshError.sessionChanged || originalRequest._sessionGeneration !== getSessionGeneration()) {
                    return Promise.reject(sessionChangedError());
                }
                clearStoredSession();
                emitAuthExpired();
                return Promise.reject(refreshError);
            }
        }

        // Waiting room and a saturated checkout both ask the buyer to retry manually.
        const busyCode = error.response?.data?.code;
        if (status === 503 && (busyCode === 'WAITING_ROOM_ACTIVE' || busyCode === 'CHECKOUT_BUSY')) {
            const delay = error.response.data.retryAfter;
            const retryAfter = Number.isSafeInteger(delay) && delay > 0 && delay <= 60 ? delay : 5;
            window.dispatchEvent(new CustomEvent('tixmo:waiting-room', { detail: { retryAfter } }));
        }

        // Dispatch global error for other failure codes (e.g. 500, 404, network error)
        else {
            window.dispatchEvent(new CustomEvent('tixmo:global-error', {
                detail: {
                    status: status || 'NETWORK_ERR',
                    message: error.response?.data?.message || error.message
                }
            }));
        }

        return Promise.reject(error);
    }
);

// Default export for backward compatibility
export default axiosInstance;

const normalizeResponse = (body) => {
    if (!body || typeof body !== 'object') {
        return body;
    }

    if (!Object.prototype.hasOwnProperty.call(body, 'data')) {
        return body;
    }

    const payload = body.data;

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return {
            ...payload,
            data: payload,
            success: body.success,
            message: body.message,
            meta: body.meta,
            raw: body,
        };
    }

    return {
        data: payload,
        success: body.success,
        message: body.message,
        meta: body.meta,
        raw: body,
    };
};

// Helper wrapper for cleaner API calls with automatic data extraction
export const api = {
    get: async (url) => {
        const response = await axiosInstance.get(url);
        return normalizeResponse(response.data);
    },
    post: async (url, data) => {
        const response = await axiosInstance.post(url, data);
        return normalizeResponse(response.data);
    },
    put: async (url, data) => {
        const response = await axiosInstance.put(url, data);
        return normalizeResponse(response.data);
    },
    patch: async (url, data) => {
        const response = await axiosInstance.patch(url, data);
        return normalizeResponse(response.data);
    },
    delete: async (url) => {
        const response = await axiosInstance.delete(url);
        return normalizeResponse(response.data);
    },
    upload: async (url, formData) => {
        const response = await axiosInstance.post(url, formData, {
            headers: {
                'Content-Type': null, // Unset default to allow browser to set multipart/form-data with boundary
            },
        });
        return normalizeResponse(response.data);
    },
};
