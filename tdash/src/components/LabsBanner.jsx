import React from 'react';
import { getLabsBranch } from '../lib/runtimeConfig';

const LabsBanner = () => {
    const branch = getLabsBranch();
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
