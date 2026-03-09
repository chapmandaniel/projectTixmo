import { api } from './api';

const unwrap = (response) => response?.data || response;

export const socialCommandCenterApi = {
    async getCommandCenter() {
        const response = await api.get('/social/command-center');
        return unwrap(response);
    },

    async updateSettings(settings) {
        const response = await api.put('/social/settings', settings);
        return unwrap(response);
    },

    async resolvePost(postId) {
        const response = await api.post(`/social/posts/${postId}/resolve`);
        return unwrap(response);
    },

    async refreshPost(postId) {
        const response = await api.post(`/social/posts/${postId}/refresh`);
        return unwrap(response);
    },
};
