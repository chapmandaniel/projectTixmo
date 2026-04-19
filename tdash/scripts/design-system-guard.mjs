import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const baselinePath = path.join(rootDir, 'design-system-guard-baseline.json');
const shouldUpdate = process.argv.includes('--update');

const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const excludedFiles = new Set([
    'src/lib/dashboardTheme.js',
    'src/components/dashboard/DashboardPrimitives.jsx',
    'src/features/DashboardHome.jsx',
    'src/layouts/DashboardLayout.jsx',
    'src/test/DashboardTruth.test.jsx',
]);

const rules = [
    {
        id: 'dashboard-token-hex',
        description: 'Raw dashboard token hex values should stay inside the design-system layer.',
        regex: /#(?:151521|1e1e2d|232336|2b2b40|a1a5b7|8e8fa6|5e6278|ff3366|ff8a3d|3a3a5a)\b/gi,
    },
    {
        id: 'arbitrary-color-utility',
        description: 'Arbitrary Tailwind color utilities should not be introduced outside the design-system layer.',
        regex: /\b(?:bg|text|border|ring|from|via|to|shadow)-\[#(?:[0-9a-fA-F]{3,8})\]/g,
    },
];

const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return walk(fullPath);
        }
        if (!allowedExtensions.has(path.extname(entry.name))) {
            return [];
        }
        return [fullPath];
    }));

    return files.flat();
};

const getLineNumber = (source, index) => source.slice(0, index).split('\n').length;

const normalizeRelative = (absolutePath) => path.relative(rootDir, absolutePath).replaceAll(path.sep, '/');

const scanFile = async (absolutePath) => {
    const relativePath = normalizeRelative(absolutePath);
    if (excludedFiles.has(relativePath)) {
        return [];
    }

    const source = await fs.readFile(absolutePath, 'utf8');
    const violations = [];

    for (const rule of rules) {
        const regex = new RegExp(rule.regex);
        let match;
        while ((match = regex.exec(source)) !== null) {
            const line = getLineNumber(source, match.index);
            const snippet = source.split('\n')[line - 1].trim();
            violations.push({
                fingerprint: `${rule.id}::${relativePath}::${match[0]}::${snippet}`,
                ruleId: rule.id,
                file: relativePath,
                line,
                match: match[0],
                snippet,
            });
        }
    }

    return violations;
};

const main = async () => {
    const files = await walk(srcDir);
    const violations = (await Promise.all(files.map(scanFile))).flat()
        .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.ruleId.localeCompare(b.ruleId));

    if (shouldUpdate) {
        await fs.writeFile(baselinePath, `${JSON.stringify({
            generatedAt: new Date().toISOString(),
            rules: rules.map(({ id, description }) => ({ id, description })),
            violations,
        }, null, 2)}\n`);
        console.log(`Updated design-system guard baseline with ${violations.length} violation(s).`);
        return;
    }

    let baseline;
    try {
        baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
    } catch (error) {
        console.error('Missing design-system baseline. Run `npm run design:guard:update` from tdash.');
        process.exit(1);
    }

    const baselineFingerprints = new Set((baseline.violations || []).map((entry) => entry.fingerprint));
    const currentFingerprints = new Set(violations.map((entry) => entry.fingerprint));

    const newViolations = violations.filter((entry) => !baselineFingerprints.has(entry.fingerprint));
    const resolvedViolations = (baseline.violations || []).filter((entry) => !currentFingerprints.has(entry.fingerprint));

    if (!newViolations.length && !resolvedViolations.length) {
        console.log(`Design-system guard passed with ${violations.length} tracked baseline violation(s) and no regressions.`);
        return;
    }

    if (newViolations.length) {
        console.error('New design-system violations detected:');
        newViolations.forEach((entry) => {
            console.error(`- ${entry.file}:${entry.line} [${entry.ruleId}] ${entry.match}`);
            console.error(`  ${entry.snippet}`);
        });
    }

    if (resolvedViolations.length) {
        console.error('Tracked violations were removed. Refresh the baseline with `npm run design:guard:update`.');
        resolvedViolations.forEach((entry) => {
            console.error(`- ${entry.file}:${entry.line} [${entry.ruleId}] ${entry.match}`);
        });
    }

    process.exit(1);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
