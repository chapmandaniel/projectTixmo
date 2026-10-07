import api from './api';
import { clearStoredSession, getAccessToken, getStoredUser, storeSession } from './session';

export const auth = {
    login: async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        const response = await api.post('/auth/login', { email: normalizedEmail, password });
        const { accessToken, refreshToken, user } = response.data.data;

        storeSession({ accessToken, refreshToken, user });

        return user;
    },

    register: async (userData) => {
        const normalizedUserData = {
            ...userData,
            email: userData.email.trim().toLowerCase(),
        };
        const response = await api.post('/auth/register', normalizedUserData);
        const { accessToken, refreshToken, user } = response.data.data;

        storeSession({ accessToken, refreshToken, user });

        return user;
    },

    acceptInvitation: async (token, password) => {
        const response = await api.post('/auth/accept-invitation', { token, password });
        const { accessToken, refreshToken, user } = response.data.data;
        storeSession({ accessToken, refreshToken, user });
        return user;
    },

    logout: async ({ notifyServer = true } = {}) => {
        const token = getAccessToken();
        clearStoredSession();
        try {
            if (notifyServer) {
                await api.post('/auth/logout', undefined, { headers: { Authorization: `Bearer ${token}` } });
            }
        } catch (error) {
            console.error('Logout failed on server', error);
        }
    },

    getCurrentUser: () => {
        return getStoredUser();
    },

    isAuthenticated: () => {
        return !!getAccessToken();
    }
};
