import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const showHelp = args.has('--help') || args.has('-h');
const noServices = args.has('--no-services');
const webOnly = args.has('--web-only');
const apiOnly = args.has('--api-only');

if (showHelp) {
    process.stdout.write(`Tixmo dev runner

Usage:
  npm run dev
  npm run dev -- --no-services
  npm run dev -- --web-only
  npm run dev -- --api-only

Flags:
  --no-services  Skip Docker startup for PostgreSQL and Redis
  --web-only     Start only tdash
  --api-only     Start only tixmoapi2
`);
    process.exit(0);
}

if (webOnly && apiOnly) {
    process.stderr.write('Choose only one of --web-only or --api-only.\n');
    process.exit(1);
}

const children = [];
let shuttingDown = false;

const prefixStream = (stream, prefix, target) => {
    if (!stream) return;

    const rl = readline.createInterface({ input: stream });
    rl.on('line', (line) => {
        target.write(`${prefix} ${line}\n`);
    });
};

const run = (label, command, commandArgs, options = {}) => {
    const child = spawn(command, commandArgs, {
        cwd: repoRoot,
        shell: true,
        env: process.env,
        ...options,
    });

    prefixStream(child.stdout, `[${label}]`, process.stdout);
    prefixStream(child.stderr, `[${label}]`, process.stderr);

    return child;
};

const runForExitCode = (label, command) => new Promise((resolve) => {
    const child = run(label, command, []);
    child.on('exit', (code) => resolve(code ?? 1));
});

const captureOutput = (command) => new Promise((resolve) => {
    const child = spawn(command, {
        cwd: repoRoot,
        shell: true,
        env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
    });

    child.on('exit', (code) => {
        resolve({
            code: code ?? 1,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
        });
    });
});

const shutdown = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const child of children) {
        if (!child.killed) {
            child.kill('SIGTERM');
        }
    }

    setTimeout(() => {
        for (const child of children) {
            if (!child.killed) {
                child.kill('SIGKILL');
            }
        }
        process.exit(code);
    }, 1500).unref();
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const startServices = async () => {
    if (noServices || webOnly) {
        return;
    }

    process.stdout.write('[root] Starting PostgreSQL and Redis via Docker Compose...\n');

    const dockerInfo = await captureOutput('docker info');
    if (dockerInfo.code !== 0) {
        const dockerContext = await captureOutput('docker context show');
        const activeContext = dockerContext.code === 0 ? dockerContext.stdout : '';

        if (activeContext === 'colima') {
            const colimaStatus = await captureOutput('colima status');
            if (colimaStatus.code !== 0) {
                process.stdout.write('[root] Docker is using the colima context and colima is stopped. Starting colima...\n');
                const startCode = await runForExitCode('colima', 'colima start');
                if (startCode !== 0) {
                    process.stderr.write('[root] Failed to start colima. Start it manually with `colima start` or rerun with --no-services.\n');
                    process.exit(1);
                }
            }
        }
    }

    const composeAttempts = [
        'docker compose -f tixmoapi2/docker-compose.yml up -d',
        'docker-compose -f tixmoapi2/docker-compose.yml up -d',
    ];

    for (const command of composeAttempts) {
        const result = await runForExitCode('services', command);

        if (result === 0) {
            process.stdout.write('[root] Services are up.\n');
            return;
        }
    }

    process.stderr.write('[root] Failed to start Docker services. If you use Colima, run `colima start`. If you use Docker Desktop, switch context with `docker context use default` and make sure Docker Desktop is running.\n');
    process.exit(1);
};

const launchTargets = () => {
    if (!apiOnly) {
        const web = run('web', 'npm', ['--prefix', 'tdash', 'run', 'dev']);
        children.push(web);
        web.on('exit', (code) => {
            if (!shuttingDown) {
                process.stderr.write(`[web] exited with code ${code ?? 1}\n`);
                shutdown(code ?? 1);
            }
        });
    }

    if (!webOnly) {
        const api = run('api', 'npm', ['--prefix', 'tixmoapi2', 'run', 'dev']);
        children.push(api);
        api.on('exit', (code) => {
            if (!shuttingDown) {
                process.stderr.write(`[api] exited with code ${code ?? 1}\n`);
                shutdown(code ?? 1);
            }
        });
    }

    if (children.length === 0) {
        process.stderr.write('[root] Nothing to run.\n');
        process.exit(1);
    }
};

await startServices();
launchTargets();
