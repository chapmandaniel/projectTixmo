import api from './api';

export const auth = {
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        const { accessToken, refreshToken, user } = response.data.data;

        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));

        return user;
    },

    register: async (userData) => {
        const response = await api.post('/auth/register', userData);
        const { accessToken, refreshToken, user } = response.data.data;

        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));

        return user;
    },

    logout: async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout failed on server', error);
        } finally {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
        }
    },

    getCurrentUser: () => {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    isAuthenticated: () => {
        return !!localStorage.getItem('access_token');
    }
};
