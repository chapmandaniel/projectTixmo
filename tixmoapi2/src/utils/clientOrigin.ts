import { config } from '../config/environment';

const TIXMO_ORIGIN_PATTERN = /^https:\/\/(?:[a-zA-Z0-9-]+\.)+tixmo\.co$/;

const normalizeOrigin = (value: string) => {
    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return undefined;
        }

        return url.origin;
    } catch (_error) {
        return undefined;
    }
};

const configuredOrigins = (() => {
    const origins = new Set<string>();
    const candidates = [
        ...(Array.isArray(config.corsOrigin) ? config.corsOrigin : [config.corsOrigin]),
        config.clientUrl,
    ];

    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }

        const origin = normalizeOrigin(candidate.trim());
        if (origin) {
            origins.add(origin);
        }
    }

    return origins;
})();

export const isTrustedClientOrigin = (value: string) => {
    const origin = normalizeOrigin(value);
    if (!origin) {
        return false;
    }

    return configuredOrigins.has(origin) || TIXMO_ORIGIN_PATTERN.test(origin);
};

export const resolveTrustedClientOrigin = (...candidates: Array<string | null | undefined>) => {
    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }

        const origin = normalizeOrigin(candidate.trim());
        if (origin && isTrustedClientOrigin(origin)) {
            return origin;
        }
    }

    return undefined;
};
