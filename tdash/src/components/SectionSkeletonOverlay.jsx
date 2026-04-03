import React from 'react';

const line = 'wireframe-line rounded-full';
const block = 'wireframe-block rounded-2xl';

const CardsSkeleton = () => (
    <div className="grid h-full gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="wireframe-panel overflow-hidden rounded-md border border-white/10">
                <div className="wireframe-block h-40 w-full" />
                <div className="space-y-3 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className={`${line} h-5 w-24`} />
                        <div className={`${line} h-4 w-10`} />
                    </div>
                    <div className={`${line} h-5 w-2/3`} />
                    <div className={`${line} h-4 w-1/2`} />
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className={`${line} h-4 w-12`} />
                            <div className={`${line} h-4 w-20`} />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <div className={`${line} h-4 w-12`} />
                            <div className={`${line} h-4 w-24`} />
                        </div>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

const ListSkeleton = () => (
    <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="wireframe-panel rounded-lg border border-white/10 px-4 py-4">
                <div className="flex items-start gap-3">
                    <div className={`${block} h-9 w-9 rounded-full`} />
                    <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex items-center justify-between gap-3">
                            <div className={`${line} h-4 w-32`} />
                            <div className={`${line} h-3 w-20`} />
                        </div>
                        <div className={`${line} h-4 w-11/12`} />
                        <div className={`${line} h-4 w-3/4`} />
                    </div>
                </div>
            </div>
        ))}
    </div>
);

const ConversationSkeleton = () => (
    <div className="space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={`flex gap-3 ${index === 1 ? 'justify-end' : ''}`}>
                {index !== 1 && <div className={`${block} h-9 w-9 rounded-full`} />}
                <div className={`wireframe-panel max-w-[84%] rounded-2xl border border-white/10 px-4 py-4 ${index === 1 ? 'ml-auto' : ''}`}>
                    <div className={`${line} h-4 w-32`} />
                    <div className={`${line} mt-3 h-4 w-64 max-w-full`} />
                    <div className={`${line} mt-2 h-4 w-48 max-w-[85%]`} />
                </div>
                {index === 1 && <div className={`${block} h-9 w-9 rounded-full`} />}
            </div>
        ))}
    </div>
);

const WorkspaceSkeleton = () => (
    <div className="flex h-full min-h-[520px] flex-col justify-between gap-4">
        <div className={`${block} h-[360px] w-full rounded-3xl`} />
        <div className="space-y-3">
            <div className={`${line} h-5 w-48`} />
            <div className={`${line} h-4 w-full`} />
            <div className={`${line} h-4 w-3/4`} />
        </div>
        <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="wireframe-panel min-h-[120px] min-w-[150px] rounded-xl border border-white/10 p-3">
                    <div className={`${block} h-14 w-full rounded-xl`} />
                    <div className={`${line} mt-3 h-4 w-3/4`} />
                    <div className={`${line} mt-2 h-3 w-1/2`} />
                </div>
            ))}
        </div>
    </div>
);

const skeletonMap = {
    cards: CardsSkeleton,
    list: ListSkeleton,
    conversation: ConversationSkeleton,
    workspace: WorkspaceSkeleton,
};

const SectionSkeletonOverlay = ({
    label = 'Updating',
    variant = 'list',
    className = '',
}) => {
    const Skeleton = skeletonMap[variant] || ListSkeleton;

    return (
        <div className={`absolute inset-0 z-20 overflow-hidden rounded-[inherit] ${className}`}>
            <div className="absolute inset-0 bg-[#0f1020]/78 backdrop-blur-[3px]" />
            <div className="relative flex h-full flex-col gap-4 p-4 sm:p-5">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-100">
                    <span className="h-2 w-2 rounded-full bg-sky-300 animate-pulse" />
                    {label}
                </div>
                <div className="min-h-0 flex-1">
                    <Skeleton />
                </div>
            </div>
        </div>
    );
};

export default SectionSkeletonOverlay;
