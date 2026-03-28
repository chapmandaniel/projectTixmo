import { afterEach, describe, expect, it } from 'vitest';
import { getApiBaseUrl } from '../lib/runtimeConfig';

describe('runtimeConfig', () => {
    afterEach(() => {
        delete window.__TIXMO_CONFIG__;
    });

    it('prefers runtime-injected API URLs', () => {
        window.__TIXMO_CONFIG__ = {
            apiUrl: 'https://api.example.com/api/v1/',
        };

        expect(getApiBaseUrl()).toBe('https://api.example.com/api/v1');
    });
});
