// General utility functions

/**
 * Creates a URL-friendly slug incorporating the human-readable string and the unique ID.
 * Example: "My Awesome Event" + "1234-5678" -> "my-awesome-event-1234-5678"
 */
export const generateEventSlug = (name, id) => {
    if (!name || !id) return id;
    const safeName = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
        .replace(/(^-|-$)/g, '');    // Remove leading/trailing hyphens
    return `${safeName}-${id}`;
};

/**
 * Extracts the UUID from the back of the friendly slug.
 * Assumes a standard UUID configuration of exactly 5 dash-separated segments at the end.
 */
export const extractIdFromSlug = (slug) => {
    if (!slug) return null;
    const parts = slug.split('-');
    // Standard UUIDs have 4 dashes (5 parts), e.g., xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    if (parts.length >= 5) {
        return parts.slice(-5).join('-');
    }
    return slug;
};
