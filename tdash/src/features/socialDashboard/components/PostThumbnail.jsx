import React from 'react';
import { cn } from '../../../lib/utils';

const FORMAT_TONES = {
    reel: 'from-fuchsia-500 to-orange-400',
    carousel: 'from-sky-500 to-indigo-500',
    image: 'from-amber-400 to-rose-500',
    text: 'from-slate-500 to-slate-700',
    story: 'from-violet-500 to-pink-500',
    video: 'from-cyan-400 to-blue-600',
    live: 'from-rose-500 to-red-600',
};

export const PostThumbnail = ({ post, className }) => (
    <div
        className={cn(
            'relative flex aspect-[4/5] w-full items-end overflow-hidden rounded-md bg-gradient-to-br p-3 text-left text-white',
            FORMAT_TONES[post.format] || FORMAT_TONES.image,
            className
        )}
        aria-hidden="true"
    >
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/80">{post.platform} · {post.format}</p>
            <p className="mt-1 text-sm font-light leading-5">{post.thumbnailLabel}</p>
        </div>
    </div>
);
