import React from 'react';
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaTiktok, FaYoutube } from 'react-icons/fa6';
import { PLATFORM_ORDER } from '../platforms';

const ICONS = {
    instagram: FaInstagram,
    facebook: FaFacebookF,
    tiktok: FaTiktok,
    youtube: FaYoutube,
    linkedin: FaLinkedinIn,
};

export const PlatformLogo = ({ platform, className = 'h-4 w-4', title }) => {
    const Icon = ICONS[platform];
    const meta = PLATFORM_ORDER.find((item) => item.id === platform);
    if (!Icon) return null;
    const fill = platform === 'tiktok' ? '#25F4EE' : (meta?.hex || 'currentColor');
    return (
        <Icon
            className={className}
            style={{ color: fill }}
            title={title || meta?.label || platform}
            aria-hidden={title ? undefined : true}
        />
    );
};

export const PlatformLogoRow = ({ platforms, className = '' }) => {
    const unique = [...new Set(platforms || [])];
    if (!unique.length) return null;
    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            {unique.map((platform) => (
                <PlatformLogo key={platform} platform={platform} />
            ))}
        </span>
    );
};
