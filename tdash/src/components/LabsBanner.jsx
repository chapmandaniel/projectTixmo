import React, { useEffect } from 'react';
import { dashShouldNoIndex } from '../lib/searchIndexing';

const labsBranch = () => {
    const runtime = typeof window === 'undefined'
        ? ''
        : String(window.__TIXMO_CONFIG__?.labsBranch || '').trim();
    const built = String(import.meta.env.VITE_APP_LABS_BRANCH || '').trim();
    return runtime || built;
};

export const NoIndexMeta = () => {
    useEffect(() => {
        if (!dashShouldNoIndex({
            appEnv: import.meta.env.VITE_APP_ENV,
            labsBranch: labsBranch(),
        })) return undefined;
        const meta = document.createElement('meta');
        meta.name = 'robots';
        meta.content = 'noindex,nofollow';
        document.head.appendChild(meta);
        return () => meta.remove();
    }, []);
    return null;
};

const LabsBanner = () => {
    const branch = labsBranch();
    if (!branch) return null;
    return (
        <>
            <div
                role="status"
                className="fixed inset-x-0 top-0 z-40 border-b border-dashboard-borderStrong bg-dashboard-panelAlt px-4 py-1 text-center text-xs text-zinc-100"
            >
                Labs · {branch}
            </div>
            <div className="h-7" aria-hidden="true" />
        </>
    );
};

export default LabsBanner;
