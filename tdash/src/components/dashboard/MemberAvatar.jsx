import React from 'react';

// Generated avatar: initials on a gradient picked from the person's name, so every member
// has a stable, distinct avatar without uploading a photo.
const GRADIENTS = [
    'from-pink-500 to-orange-400',
    'from-violet-500 to-fuchsia-400',
    'from-sky-500 to-cyan-400',
    'from-emerald-500 to-lime-400',
    'from-amber-500 to-rose-400',
    'from-indigo-500 to-sky-400',
    'from-teal-500 to-emerald-400',
    'from-rose-500 to-purple-400',
];

const SIZES = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-sm',
};

export const avatarGradient = (seed = '') => {
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return GRADIENTS[h % GRADIENTS.length];
};

const MemberAvatar = ({ firstName = '', lastName = '', email = '', size = 'md', className = '', title, muted = false }) => {
    const initials = `${firstName?.[0] || email?.[0] || '?'}${lastName?.[0] || ''}`.toUpperCase();
    return (
        <span
            aria-hidden={title ? undefined : true}
            title={title}
            data-testid="member-avatar"
            className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-medium text-white shadow-sm ring-2 ring-black/10 ${avatarGradient(`${firstName} ${lastName} ${email}`)} ${SIZES[size] || SIZES.md} ${muted ? 'opacity-60 grayscale' : ''} ${className}`}
        >
            {initials}
        </span>
    );
};

export const relativeActive = (iso, now = Date.now()) => {
    if (!iso) return null;
    const diff = Math.max(0, now - new Date(iso).getTime());
    const m = Math.round(diff / 60000);
    if (m < 2) return 'Active now';
    if (m < 60) return `Active ${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `Active ${h} hr ago`;
    const d = Math.round(h / 24);
    return `Active ${d} day${d === 1 ? '' : 's'} ago`;
};

export default MemberAvatar;
