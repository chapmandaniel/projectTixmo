import React from 'react';

const badgeClass = 'inline-flex items-center gap-2 rounded-sm border border-[#434b5f] bg-[#181c25] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#d7dbe6]';
const blockClass = 'rounded-sm border border-[#3d4557] bg-[#1a1e27]';

const PendingSectionBlocker = ({ label = 'Refreshing', className = '' }) => (
    <div
        className={`absolute inset-0 z-20 rounded-[inherit] border border-[#262d3b] bg-[#11141b] p-4 ${className}`}
        role="status"
        aria-live="polite"
    >
        <div className="flex h-full flex-col gap-4 rounded-[inherit] border border-[#2f3747] bg-[#141922] p-4">
            <div className="flex items-center justify-between gap-3">
                <span className={badgeClass}>
                    <span className="h-2 w-2 rounded-[2px] bg-[#8d96ab] animate-pulse" />
                    {label}
                </span>
                <div className={`${blockClass} h-8 w-24`} />
            </div>

            <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)]">
                <div className="grid gap-3">
                    <div className={`${blockClass} h-11`} />
                    <div className={`${blockClass} h-24`} />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className={`${blockClass} h-20`} />
                        <div className={`${blockClass} h-20`} />
                    </div>
                    <div className={`${blockClass} h-10 w-3/4`} />
                </div>

                <div className="grid gap-3">
                    <div className={`${blockClass} h-28`} />
                    <div className={`${blockClass} h-10`} />
                    <div className="grid grid-cols-3 gap-3">
                        <div className={`${blockClass} h-14`} />
                        <div className={`${blockClass} h-14`} />
                        <div className={`${blockClass} h-14`} />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default PendingSectionBlocker;
