const RESERVED_SUBDOMAINS = new Set(['api', 'app', 'demo', 'www']);
const RESERVED_PROJECT_NAMES = new Set(['api and dashboard', 'hq']);

const normalizeHost = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//, '');
  const hostWithPath = withoutProtocol.split('/')[0];
  const host = hostWithPath.split(':')[0];

  return host || null;
};

const isRailwayServiceHost = (host: string) =>
  host.endsWith('.up.railway.app') || host.endsWith('.railway.internal');

const formatTenantName = (label: string) =>
  label
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export interface TenantOrganizationSeed {
  label: string;
  name: string;
  slug: string;
}

export const extractTenantLabelFromHost = (input?: string | null) => {
  const host = normalizeHost(input);
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
    return null;
  }

  if (isRailwayServiceHost(host)) {
    return null;
  }

  const knownTenantSuffixes = ['.tixmo.co', '.tixmo.com'];
  for (const suffix of knownTenantSuffixes) {
    if (host.endsWith(suffix)) {
      const label = host.slice(0, -suffix.length);
      if (!label || RESERVED_SUBDOMAINS.has(label)) {
        return null;
      }
      return label;
    }
  }

  const hostParts = host.split('.');
  if (hostParts.length === 2) {
    return hostParts[0] || null;
  }

  return null;
};

export const extractTenantLabelFromProjectName = (projectName?: string | null) => {
  if (!projectName) {
    return null;
  }

  const normalized = projectName.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  let label = normalized;
  if (normalized.startsWith('tixmo ')) {
    label = normalized.slice('tixmo '.length).trim();
  } else if (normalized.startsWith('tixmo-')) {
    label = normalized.slice('tixmo-'.length).trim();
  }

  if (!label || RESERVED_PROJECT_NAMES.has(label)) {
    return null;
  }

  return label;
};

export const resolveTenantOrganizationSeed = (input?: {
  requestHost?: string | null;
  serviceDashUrl?: string | null;
  projectName?: string | null;
}): TenantOrganizationSeed | null => {
  const label =
    extractTenantLabelFromHost(input?.requestHost) ||
    extractTenantLabelFromHost(input?.serviceDashUrl) ||
    extractTenantLabelFromProjectName(input?.projectName);

  if (!label) {
    return null;
  }

  return {
    label,
    name: formatTenantName(label),
    slug: label.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  };
};
