jest.mock('../../src/config/environment', () => ({
    config: {
        clientUrl: 'https://dashboard.example.com',
        corsOrigin: ['http://localhost:3001', 'http://localhost:5173'],
    },
}));

import { isTrustedClientOrigin, resolveTrustedClientOrigin } from '../../src/utils/clientOrigin';

describe('client origin helpers', () => {
    it('accepts configured localhost origins', () => {
        expect(isTrustedClientOrigin('http://localhost:3001')).toBe(true);
    });

    it('accepts tixmo subdomains and strips referer paths', () => {
        expect(resolveTrustedClientOrigin('https://mightyquinton.tixmo.co/approvals/abc?tab=reviewers')).toBe(
            'https://mightyquinton.tixmo.co'
        );
    });

    it('rejects arbitrary Railway hosts', () => {
        expect(isTrustedClientOrigin('https://evil.up.railway.app')).toBe(false);
    });
});
