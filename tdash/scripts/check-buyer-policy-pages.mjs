import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dashboardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buyerPages = ['terms.html', 'refunds.html', 'privacy.html', 'cancellation.html'];

const fail = (message) => {
    process.stderr.write(`${message}\n`);
    process.exit(1);
};

const read = (relativePath) => readFileSync(path.join(dashboardRoot, relativePath));

for (const name of buyerPages) {
    const source = read(path.join('public', name));
    let built;
    try {
        built = read(path.join('dist', name));
    } catch {
        fail(`Vite build did not copy public/${name} to dist/${name}.`);
    }
    if (!source.equals(built)) {
        fail(`dist/${name} does not match public/${name}.`);
    }
    const text = source.toString('utf8');
    if (!text.includes('DRAFT, NOT FOR PUBLICATION UNTIL DANIEL APPROVES')) {
        fail(`${name} is missing the draft publication marker.`);
    }
    if (!text.includes('<meta name="robots" content="noindex, nofollow">')) {
        fail(`${name} is missing the noindex marker.`);
    }
}

const refunds = read('dist/refunds.html').toString('utf8');
if (!refunds.includes('Decision 2B')) {
    fail('dist/refunds.html is not the staff-issued refund page.');
}
for (const root of ['public', 'dist']) {
    try {
        read(path.join(root, 'refunds-fallback-2A.html'));
        fail(`${root}/refunds-fallback-2A.html must not be published.`);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

const nginx = read('nginx.site.conf').toString('utf8');
const location = nginx.match(/location \/ \{[^}]*\}/);
if (!location) {
    fail('nginx.site.conf is missing location /.');
}
const tryFiles = location[0].match(/try_files\s+([^;]+);/);
if (!tryFiles) {
    fail('nginx location / is missing try_files.');
}
const targets = tryFiles[1].trim().split(/\s+/);
const fileIndex = targets.indexOf('$uri');
const fallbackIndex = targets.indexOf('/index.html');
if (fileIndex !== 0 || fallbackIndex < 0 || fileIndex > fallbackIndex) {
    fail('nginx SPA fallback would be tried before an existing policy page.');
}

const resolve = (urlPath) => (targets[fileIndex] === '$uri' && buyerPages.includes(urlPath.slice(1))
    ? urlPath
    : targets[fallbackIndex]);
for (const name of buyerPages) {
    if (resolve(`/${name}`) !== `/${name}`) {
        fail(`/${name} would be swallowed by the SPA fallback.`);
    }
}
if (resolve('/missing-policy.html') !== '/index.html') {
    fail('A missing path would not use the SPA fallback.');
}

process.stdout.write('Buyer policy pages are in the Vite build output, and nginx tries each file before the SPA fallback.\n');
