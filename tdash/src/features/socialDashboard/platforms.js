export const PLATFORM_ORDER = [
    { id: 'instagram', label: 'Instagram', hex: '#E4405F' },
    { id: 'facebook', label: 'Facebook', hex: '#1877F2' },
    { id: 'tiktok', label: 'TikTok', hex: '#25F4EE' },
    { id: 'youtube', label: 'YouTube', hex: '#FF0000' },
    { id: 'linkedin', label: 'LinkedIn', hex: '#0A66C2' },
];

const MENTION_SOURCE_TO_PLATFORM = {
    Instagram: 'instagram',
    Facebook: 'facebook',
    TikTok: 'tiktok',
    YouTube: 'youtube',
    LinkedIn: 'linkedin',
};

export const parsePlatformFilter = (value) => {
    const known = new Set(PLATFORM_ORDER.map((item) => item.id));
    const parts = String(value || '')
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter((part) => known.has(part));
    return [...new Set(parts)];
};

export const serializePlatformFilter = (ids) => {
    const unique = PLATFORM_ORDER
        .map((item) => item.id)
        .filter((id) => (ids || []).includes(id));
    if (!unique.length || unique.length === PLATFORM_ORDER.length) return '';
    return unique.join(',');
};

export const platformsInMocks = (accounts) => {
    const present = new Set((accounts || []).map((account) => account.platform));
    return PLATFORM_ORDER.filter((item) => present.has(item.id));
};

export const mentionSourcePlatform = (source) => MENTION_SOURCE_TO_PLATFORM[source] || null;

export const platformLabel = (id) => PLATFORM_ORDER.find((item) => item.id === id)?.label || id;
