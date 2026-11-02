// Market-readiness audit exception.
//
// GHSA-gcqx-w48m-w2h4 (CVE-2026-93753) covers deepmerge >=4.2.0 <=4.3.1.
// https://github.com/advisories/GHSA-gcqx-w48m-w2h4
// As of 2026-10-28 the advisory has no first_patched_version. npm's only
// suggested fix is a breaking downgrade to Jest 25. Remove this exception
// when a patched deepmerge is published and the lockfile no longer resolves
// a version inside that range. Review it again on 2026-11-28 if the patch
// is still missing.

export const DEEPMERGE_DEV_ADVISORY = 'GHSA-gcqx-w48m-w2h4';

// GHSA-g3hv-75wg-m249 covers minimatch <11.0.1.
// https://github.com/advisories/GHSA-g3hv-75wg-m249
// minimatch 10 is overridden to 11.0.3. minimatch 3.x has to stay. glob 7,
// reached through rimraf 3 and ESLint's flat-cache, walks minimatch v3 `set`
// segments and `GLOBSTAR`. minimatch 11's `set` is a matcher matrix, so that
// copy cannot move. An override scoped to eslint would still replace it,
// because glob 7 sits inside eslint's tree. @eslint/eslintrc and
// @humanwhocodes/config-array depend on the same minimatch 3 line directly.
// There is no patched 3.x release. Every remaining copy must be dev-only, off
// the production walk, and required only by those packages or glob 7.
// Remove this exception when they no longer install minimatch below 11.0.1.
// Review it again on 2026-11-30.
export const MINIMATCH_DEV_ADVISORY = 'GHSA-g3hv-75wg-m249';

const EXEMPT_ADVISORY_PACKAGES = new Map([
  [DEEPMERGE_DEV_ADVISORY.toLowerCase(), 'deepmerge'],
  [MINIMATCH_DEV_ADVISORY.toLowerCase(), 'minimatch'],
]);

const MINIMATCH_V3_PARENTS = new Set([
  'eslint',
  '@eslint/eslintrc',
  '@humanwhocodes/config-array',
  'glob',
]);

const ADVISORY_ID = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i;

function advisoryId(via) {
  if (!via || typeof via !== 'object') return null;
  const match = String(via.url || '').match(ADVISORY_ID);
  return match ? match[0] : null;
}

function collectAdvisoryIds(vulnerabilities) {
  const ids = new Set();
  for (const vuln of Object.values(vulnerabilities)) {
    for (const via of vuln.via || []) {
      const id = advisoryId(via);
      if (id) ids.add(id);
    }
  }
  return ids;
}

function stronglyConnected(adjacency) {
  const count = adjacency.length;
  const index = new Array(count).fill(-1);
  const low = new Array(count).fill(0);
  const stacked = new Array(count).fill(false);
  const stack = [];
  const component = new Array(count).fill(-1);
  let nextIndex = 0;
  let nextComponent = 0;
  const visit = (node) => {
    index[node] = nextIndex;
    low[node] = nextIndex;
    nextIndex += 1;
    stack.push(node);
    stacked[node] = true;
    for (const next of adjacency[node]) {
      if (index[next] === -1) {
        visit(next);
        low[node] = Math.min(low[node], low[next]);
      } else if (stacked[next]) {
        low[node] = Math.min(low[node], index[next]);
      }
    }
    if (low[node] === index[node]) {
      let member = -1;
      do {
        member = stack.pop();
        stacked[member] = false;
        component[member] = nextComponent;
      } while (member !== node);
      nextComponent += 1;
    }
  };
  for (let node = 0; node < count; node += 1) {
    if (index[node] === -1) visit(node);
  }
  return component;
}

function onlyExemptAdvisories(vulnerabilities) {
  const names = Object.keys(vulnerabilities);
  const edges = new Map();
  for (const name of names) {
    const vuln = vulnerabilities[name];
    if (!vuln || !Array.isArray(vuln.via) || vuln.via.length === 0) return false;
    const next = [];
    for (const via of vuln.via) {
      if (typeof via === 'string') {
        if (!Object.prototype.hasOwnProperty.call(vulnerabilities, via)) return false;
        next.push(via);
        continue;
      }
      const id = advisoryId(via)?.toLowerCase();
      const target = via.dependency || via.name;
      if (!id || EXEMPT_ADVISORY_PACKAGES.get(id) !== target || name !== target) return false;
      next.push(null);
    }
    edges.set(name, next);
  }

  // A dependency cycle is fine when every edge that leaves it reaches an
  // exempt advisory. A cycle with no such edge is not.
  const explained = new Set();
  let progress = true;
  while (progress) {
    progress = false;
    const remaining = names.filter((name) => !explained.has(name));
    if (remaining.length === 0) break;
    const position = new Map(remaining.map((name, item) => [name, item]));
    const adjacency = remaining.map((name) => edges.get(name).filter((edge) => edge && position.has(edge)).map((edge) => position.get(edge)));
    const componentOf = stronglyConnected(adjacency);
    const groups = new Map();
    remaining.forEach((name, item) => {
      const id = componentOf[item];
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(name);
    });
    for (const group of groups.values()) {
      const members = new Set(group);
      let hasExit = false;
      let exitExplained = true;
      for (const name of group) {
        for (const edge of edges.get(name)) {
          if (edge === null || !members.has(edge)) {
            hasExit = true;
            if (edge !== null && !explained.has(edge)) exitExplained = false;
          }
        }
      }
      if (hasExit && exitExplained) {
        for (const name of group) explained.add(name);
        progress = true;
      }
    }
  }
  return names.every((name) => explained.has(name));
}

function packageName(key) {
  if (!key) return '';
  const parts = key.split('node_modules/');
  return parts[parts.length - 1];
}

function versionBelow(version, cutoff) {
  const parse = (value) => String(value || '').split('.').map((part) => {
    const match = /^(\d+)/.exec(part);
    return match ? Number(match[1]) : 0;
  });
  const left = parse(version);
  const right = parse(cutoff);
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] || 0;
    const b = right[index] || 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
}

function resolveInstalled(packages, parentKey, name) {
  let cursor = parentKey;
  while (true) {
    const candidate = cursor ? `${cursor}/node_modules/${name}` : `node_modules/${name}`;
    if (Object.prototype.hasOwnProperty.call(packages, candidate)) return candidate;
    if (!cursor) return null;
    const nested = cursor.lastIndexOf('/node_modules/');
    cursor = nested === -1 ? '' : cursor.slice(0, nested);
  }
}

function dependencyNames(node, includeDev) {
  return [
    ...Object.keys(node?.dependencies || {}),
    ...Object.keys(node?.optionalDependencies || {}),
    ...(includeDev ? Object.keys(node?.devDependencies || {}) : []),
  ];
}

function walk(packages, roots) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length) {
    const key = queue.pop();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const node = packages[key];
    if (!node) continue;
    for (const name of dependencyNames(node, false)) {
      const next = resolveInstalled(packages, key, name);
      if (next) queue.push(next);
    }
  }
  return seen;
}

function deepmergeInstalls(lockfile) {
  const packages = lockfile?.packages;
  if (!packages || typeof packages !== 'object') return { ok: false, reason: 'lockfile has no package graph' };
  const keys = Object.keys(packages).filter(
    (key) => key === 'node_modules/deepmerge' || key.endsWith('/node_modules/deepmerge')
  );
  if (keys.length === 0) return { ok: false, reason: `${DEEPMERGE_DEV_ADVISORY} is present but deepmerge is not installed` };

  const root = packages[''] || {};
  const prodRoots = [];
  for (const name of dependencyNames(root, false)) {
    const key = resolveInstalled(packages, '', name);
    if (key) prodRoots.push(key);
  }
  const prod = walk(packages, prodRoots);
  const jestKey = resolveInstalled(packages, '', 'jest');
  if (!jestKey) return { ok: false, reason: `${DEEPMERGE_DEV_ADVISORY} is present but jest is not installed` };
  const jestTree = walk(packages, [jestKey]);

  for (const key of keys) {
    if (packages[key]?.dev !== true) {
      return { ok: false, reason: `${key} is not a dev-only install` };
    }
    if (prod.has(key)) return { ok: false, reason: `${DEEPMERGE_DEV_ADVISORY} is reachable from a production dependency` };
    if (!jestTree.has(key)) return { ok: false, reason: `${key} is not under jest` };
  }

  for (const [key, node] of Object.entries(packages)) {
    for (const name of dependencyNames(node, key === '')) {
      if (name !== 'deepmerge') continue;
      if (!jestTree.has(key)) {
        return { ok: false, reason: `deepmerge is required by ${key || 'the package root'}, which is not under jest` };
      }
    }
  }
  return { ok: true };
}

function minimatchInstalls(lockfile) {
  const packages = lockfile?.packages;
  if (!packages || typeof packages !== 'object') return { ok: false, reason: 'lockfile has no package graph' };
  const keys = Object.keys(packages).filter(
    (key) => key === 'node_modules/minimatch' || key.endsWith('/node_modules/minimatch')
  );
  const vulnerable = keys.filter((key) => versionBelow(packages[key]?.version, '11.0.1'));
  if (vulnerable.length === 0) {
    return { ok: false, reason: `${MINIMATCH_DEV_ADVISORY} is present but no minimatch below 11.0.1 is installed` };
  }

  const root = packages[''] || {};
  const prodRoots = [];
  for (const name of dependencyNames(root, false)) {
    const key = resolveInstalled(packages, '', name);
    if (key) prodRoots.push(key);
  }
  const prod = walk(packages, prodRoots);

  for (const key of vulnerable) {
    if (packages[key]?.dev !== true) {
      return { ok: false, reason: `${key} is not a dev-only install` };
    }
    if (prod.has(key)) return { ok: false, reason: `${MINIMATCH_DEV_ADVISORY} is reachable from a production dependency` };
  }

  for (const [key, node] of Object.entries(packages)) {
    for (const name of dependencyNames(node, key === '')) {
      if (name !== 'minimatch') continue;
      const installed = resolveInstalled(packages, key, name);
      if (!installed || !vulnerable.includes(installed)) continue;
      const parent = packageName(key);
      if (!MINIMATCH_V3_PARENTS.has(parent)) {
        return {
          ok: false,
          reason: `${packages[installed].version} minimatch is required by ${key || 'the package root'}, which cannot keep minimatch 3`,
        };
      }
      if (parent === 'glob' && !String(node.version || '').startsWith('7.')) {
        return { ok: false, reason: `glob ${node.version || 'unknown'} still depends on minimatch ${packages[installed].version}` };
      }
    }
  }
  return { ok: true };
}

export function evaluateDependencyAudit(report, lockfile) {
  if (!report || typeof report !== 'object' || report.error) {
    return { ok: false, reason: 'npm audit did not return a vulnerability report' };
  }
  const vulnerabilities = report.vulnerabilities || {};
  const ids = collectAdvisoryIds(vulnerabilities);
  if (ids.size === 0) {
    if (Object.keys(vulnerabilities).length > 0) {
      return { ok: false, reason: 'audit findings have no advisory id' };
    }
    const total = report.metadata?.vulnerabilities?.total;
    if (typeof total === 'number' && total !== 0) {
      return { ok: false, reason: 'audit metadata reports vulnerabilities that were not listed' };
    }
    return { ok: true, ignored: null };
  }
  for (const id of ids) {
    if (!EXEMPT_ADVISORY_PACKAGES.has(id.toLowerCase())) {
      return { ok: false, reason: `advisory ${id} is not exempt` };
    }
  }
  if (!onlyExemptAdvisories(vulnerabilities)) {
    return { ok: false, reason: 'an exempt advisory is mixed with another finding' };
  }
  const ignored = [];
  if (ids.has(DEEPMERGE_DEV_ADVISORY) || [...ids].some((id) => id.toLowerCase() === DEEPMERGE_DEV_ADVISORY.toLowerCase())) {
    const installs = deepmergeInstalls(lockfile);
    if (!installs.ok) return installs;
    ignored.push(`ignored ${DEEPMERGE_DEV_ADVISORY} on dev-only deepmerge under jest; remove when a patched deepmerge exists (https://github.com/advisories/GHSA-gcqx-w48m-w2h4)`);
  }
  if ([...ids].some((id) => id.toLowerCase() === MINIMATCH_DEV_ADVISORY.toLowerCase())) {
    const installs = minimatchInstalls(lockfile);
    if (!installs.ok) return installs;
    ignored.push(`ignored ${MINIMATCH_DEV_ADVISORY} on dev-only minimatch 3 under eslint and glob 7; remove when those packages stop installing minimatch below 11.0.1 (https://github.com/advisories/GHSA-g3hv-75wg-m249)`);
  }
  return { ok: true, ignored: ignored.join('; ') };
}
