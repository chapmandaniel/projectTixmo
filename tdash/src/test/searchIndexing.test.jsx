import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { dashShouldNoIndex } from '../lib/searchIndexing';
import { NoIndexMeta } from '../components/LabsBanner';

describe('dashboard search indexing', () => {
    afterEach(() => {
        delete window.__TIXMO_CONFIG__;
        document.head.querySelectorAll('meta[name="robots"]').forEach((node) => node.remove());
    });

    it('leaves production indexable and blocks labs and other app envs', () => {
        expect(dashShouldNoIndex({ appEnv: 'production', labsBranch: '' })).toBe(false);
        expect(dashShouldNoIndex({ appEnv: '', labsBranch: '' })).toBe(false);
        expect(dashShouldNoIndex({ appEnv: 'production', labsBranch: 'cursor/labs' })).toBe(true);
        expect(dashShouldNoIndex({ appEnv: 'labs', labsBranch: '' })).toBe(true);
        expect(dashShouldNoIndex({ appEnv: '', labsBranch: 'cursor/vendor-import-showpass-5658' })).toBe(true);
    });

    it('adds a noindex meta tag only when a labs branch is configured', () => {
        const hidden = render(<NoIndexMeta />);
        expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
        hidden.unmount();
        window.__TIXMO_CONFIG__ = { labsBranch: 'cursor/vendor-import-showpass-5658' };
        render(<NoIndexMeta />);
        expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    });
});
