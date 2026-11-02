import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const tdash = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const meta = '<meta name="robots" content="noindex,nofollow" />';

const expectMeta = (appEnv, labsBranch) => {
    const env = String(appEnv || '').trim().toLowerCase();
    if (String(labsBranch || '').trim()) return true;
    return Boolean(env) && env !== 'production';
};

const assertHtml = (html, wanted, label) => {
    const present = html.includes(meta);
    if (wanted && !present) throw new Error(`${label} index.html is missing the static robots meta`);
    if (!wanted && html.includes('name="robots"')) {
        throw new Error(`${label} index.html includes a robots meta`);
    }
    if (wanted && html.indexOf(meta) > html.indexOf('</head>')) {
        throw new Error(`${label} robots meta is outside head`);
    }
};

const current = await readFile(path.join(tdash, 'dist/index.html'), 'utf8');
assertHtml(
    current,
    expectMeta(process.env.VITE_APP_ENV, process.env.VITE_APP_LABS_BRANCH),
    'current build',
);

const htmlFor = async ({ appEnv, labsBranch }) => {
    const previousEnv = process.env.VITE_APP_ENV;
    const previousBranch = process.env.VITE_APP_LABS_BRANCH;
    if (appEnv) process.env.VITE_APP_ENV = appEnv;
    else delete process.env.VITE_APP_ENV;
    if (labsBranch) process.env.VITE_APP_LABS_BRANCH = labsBranch;
    else delete process.env.VITE_APP_LABS_BRANCH;
    const outDir = await mkdtemp(path.join(tmpdir(), 'tixmo-robots-'));
    try {
        await build({
            root: tdash,
            configFile: path.join(tdash, 'vite.config.js'),
            build: { outDir, emptyOutDir: true },
            logLevel: 'error',
        });
        return await readFile(path.join(outDir, 'index.html'), 'utf8');
    } finally {
        if (previousEnv === undefined) delete process.env.VITE_APP_ENV;
        else process.env.VITE_APP_ENV = previousEnv;
        if (previousBranch === undefined) delete process.env.VITE_APP_LABS_BRANCH;
        else process.env.VITE_APP_LABS_BRANCH = previousBranch;
        await rm(outDir, { recursive: true, force: true });
    }
};

assertHtml(await htmlFor({ labsBranch: 'cursor/vendor-import-showpass-5658' }), true, 'labs build');
assertHtml(await htmlFor({ appEnv: 'production' }), false, 'production build');
console.log('robots html check passed');
