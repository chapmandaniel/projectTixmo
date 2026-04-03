import React from 'react';

const badgeClass = 'inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-[#0f1020]/90 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-sky-100 shadow-lg shadow-black/20 backdrop-blur';

const PendingSectionBlocker = ({ label = 'Refreshing', className = '' }) => (
    <div className={`absolute inset-0 z-20 flex items-start justify-center rounded-[inherit] bg-[#0f1020]/42 backdrop-blur-[2px] ${className}`}>
        <span className={`${badgeClass} mt-4`}>
            <span className="h-2 w-2 rounded-full bg-sky-300 animate-pulse" />
            {label}
        </span>
    </div>
);

export default PendingSectionBlocker;
