import api from './api';
import { clearStoredSession, getAccessToken, getStoredUser, storeSession } from './session';

export const auth = {
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        const { accessToken, refreshToken, user } = response.data.data;

        storeSession({ accessToken, refreshToken, user });

        return user;
    },

    register: async (userData) => {
        const response = await api.post('/auth/register', userData);
        const { accessToken, refreshToken, user } = response.data.data;

        storeSession({ accessToken, refreshToken, user });

        return user;
    },

    logout: async ({ notifyServer = true } = {}) => {
        try {
            if (notifyServer) {
                await api.post('/auth/logout');
            }
        } catch (error) {
            console.error('Logout failed on server', error);
        } finally {
            clearStoredSession();
        }
    },

    getCurrentUser: () => {
        return getStoredUser();
    },

    isAuthenticated: () => {
        return !!getAccessToken();
    }
};
