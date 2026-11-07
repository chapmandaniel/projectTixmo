const GIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const MAX_RELEASE_LABEL_LENGTH = 64;

// Public health identifier only. Sentry keeps the raw config.release value.
// A git SHA becomes its first 7 hex characters, lowercased. Other labels are
// trimmed and capped. Missing or blank values are null.
export const formatHealthRelease = (value: string | null | undefined): string | null => {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  if (GIT_SHA_PATTERN.test(trimmed)) {
    return trimmed.slice(0, 7).toLowerCase();
  }

  return trimmed.slice(0, MAX_RELEASE_LABEL_LENGTH);
};
