import { afterEach, describe, expect, it } from 'vitest';
import {
    getApiBaseUrl,
    getPaymentCurrency,
    getPolicyLinks,
    getStripePublishableKey,
} from '../lib/runtimeConfig';

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

    it('reads policy links from runtime config', () => {
        window.__TIXMO_CONFIG__ = {
            privacyPolicyUrl: 'https://tixmo.example/privacy/',
            termsUrl: 'https://tixmo.example/terms/',
            refundPolicyUrl: 'https://tixmo.example/refunds/',
            organizerTermsUrl: 'https://tixmo.example/organizers/',
        };

        expect(getPolicyLinks()).toEqual({
            privacyPolicyUrl: 'https://tixmo.example/privacy',
            termsUrl: 'https://tixmo.example/terms',
            refundPolicyUrl: 'https://tixmo.example/refunds',
            organizerTermsUrl: 'https://tixmo.example/organizers',
        });
    });

    it('returns empty policy links when launch policy URLs are not configured', () => {
        expect(getPolicyLinks()).toEqual({
            privacyPolicyUrl: '',
            termsUrl: '',
            refundPolicyUrl: '',
            organizerTermsUrl: '',
        });
    });

    it('reads the Stripe publishable key from runtime config', () => {
        window.__TIXMO_CONFIG__ = {
            stripePublishableKey: 'pk_test_runtime',
        };

        expect(getStripePublishableKey()).toBe('pk_test_runtime');
    });

    it('reads payment currency from runtime config and defaults to usd', () => {
        expect(getPaymentCurrency()).toBe('usd');

        window.__TIXMO_CONFIG__ = {
            paymentCurrency: 'cad',
        };

        expect(getPaymentCurrency()).toBe('cad');
    });
});
