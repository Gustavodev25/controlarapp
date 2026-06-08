#!/usr/bin/env node

/**
 * dev-tunnel.js
 *
 * Starts the same local development stack as `npm run dev`, but exposes both
 * Expo Metro and the local backend through Cloudflare quick tunnels.
 */

const { spawn, spawnSync, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const qrcode = require('qrcode-terminal');

const parsePort = (value, fallback) => {
    const port = Number(value);
    return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
};

const METRO_PORT = parsePort(process.env.CONTROLAR_METRO_PORT, 8081);
const SERVER_PORT = parsePort(process.env.CONTROLAR_API_PORT || process.env.PORT, 3001);
const PROJECT_DIR = process.cwd();
const SERVER_DIR = path.join(PROJECT_DIR, 'server');
const ROOT_ENV_FILE = path.join(PROJECT_DIR, '.env');
const SERVER_ENV_FILE = path.join(SERVER_DIR, '.env');
const LOCAL_API_HEALTH_URL = `http://127.0.0.1:${SERVER_PORT}/health`;
const METRO_STATUS_URL = `http://127.0.0.1:${METRO_PORT}/status`;
const TUNNEL_URL_PATTERN = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
const DEFAULT_PRODUCTION_API_URL = 'https://backendcontrolarapp-production.up.railway.app';
const SERVER_REQUIRED_MODULES = ['express', 'cors', 'dotenv', 'zod', 'nodemon'];
const SERVER_REQUIRED_ENV_KEYS = ['PLUGGY_CLIENT_ID', 'PLUGGY_CLIENT_SECRET'];
const SERVER_IMPORTANT_ENV_GROUPS = [
    {
        label: 'Firebase Admin',
        options: [
            ['FIREBASE_SERVICE_ACCOUNT'],
            ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'],
        ],
        impact: 'IAP status routes will fail with "Firebase Service Account not configured".',
    },
    {
        label: 'Google Play Billing',
        options: [
            ['GOOGLE_PLAY_SERVICE_ACCOUNT'],
            ['GOOGLE_PLAY_CLIENT_EMAIL', 'GOOGLE_PLAY_PRIVATE_KEY'],
        ],
        impact: 'Google Play purchase validation and subscription refresh will fail.',
    },
];
const DEV_PLACEHOLDER_ENV = {
    PLUGGY_CLIENT_ID: 'dev-tunnel-missing-pluggy-client-id',
    PLUGGY_CLIENT_SECRET: 'dev-tunnel-missing-pluggy-client-secret',
};

const colors = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
};

let isShuttingDown = false;

function log(tag, color, msg) {
    console.log(`${color}[${tag}]${colors.reset} ${msg}`);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

function getNpmCliPath(commandName) {
    const npmExecPath = process.env.npm_execpath;
    if (!npmExecPath || !fs.existsSync(npmExecPath)) return null;

    if (commandName === 'npm') return npmExecPath;

    if (commandName === 'npx') {
        const npxCliPath = path.join(path.dirname(npmExecPath), 'npx-cli.js');
        return fs.existsSync(npxCliPath) ? npxCliPath : null;
    }

    return null;
}

function quoteCmdArg(arg) {
    const value = String(arg);
    if (value.length === 0) return '""';
    if (!/[ \t"&|<>^()%!]/.test(value)) return value;

    return `"${value
        .replace(/"/g, '\\"')
        .replace(/([&|<>^])/g, '^$1')
        .replace(/%/g, '%%')}"`;
}

function resolveSpawnCommand(command, args) {
    const commandName = path.basename(command).toLowerCase().replace(/\.cmd$/, '');

    if (commandName === 'npm' || commandName === 'npx') {
        const cliPath = getNpmCliPath(commandName);
        if (cliPath) {
            return {
                command: process.execPath,
                args: [cliPath, ...args],
            };
        }

        if (process.platform === 'win32') {
            const commandLine = [`${commandName}.cmd`, ...args].map(quoteCmdArg).join(' ');
            return {
                command: 'cmd.exe',
                args: ['/d', '/s', '/c', commandLine],
            };
        }
    }

    return { command, args };
}

function getAppSlug() {
    try {
        const appJsonPath = path.join(process.cwd(), 'app.json');
        const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
        return appJson.expo?.slug || 'controlarapp';
    } catch {
        return 'controlarapp';
    }
}

function printHeader(rawArgs) {
    console.log('');
    console.log(`${colors.bold}${colors.cyan}ControlarApp dev:tunnel${colors.reset}`);
    console.log(`${colors.dim}App: ${getAppSlug()} | Metro: ${METRO_PORT} | API: ${SERVER_PORT}${colors.reset}`);
    if (rawArgs.length > 0) {
        console.log(`${colors.dim}Expo args: ${rawArgs.join(' ')}${colors.reset}`);
    }
    console.log('');
}

function killPort(port) {
    if (process.platform !== 'win32') return;

    try {
        const output = execSync('netstat -ano', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const pids = new Set();

        output.split(/\r?\n/).forEach((line) => {
            const columns = line.trim().split(/\s+/);
            if (columns.length < 5) return;

            const localAddress = columns[1];
            const pid = columns[columns.length - 1];
            if (!new RegExp(`:${port}$`).test(localAddress)) return;
            if (/^\d+$/.test(pid) && pid !== '0') {
                pids.add(pid);
            }
        });

        pids.forEach((pid) => {
            try {
                execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                log('cleanup', colors.yellow, `Stopped PID ${pid} on port ${port}`);
            } catch {
                // The process may already have exited.
            }
        });
    } catch {
        // Ignore netstat/taskkill failures. The next startup step will report a real error.
    }
}

function spawnProcess(command, args, options = {}) {
    const resolved = resolveSpawnCommand(command, args);

    return spawn(resolved.command, resolved.args, {
        cwd: PROJECT_DIR,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        ...options,
    });
}

function canResolveFromServer(moduleName) {
    try {
        require.resolve(moduleName, { paths: [SERVER_DIR] });
        return true;
    } catch {
        return false;
    }
}

function ensureServerDependencies() {
    const missingModules = SERVER_REQUIRED_MODULES.filter((moduleName) => !canResolveFromServer(moduleName));
    if (missingModules.length === 0) return;

    if (process.env.CONTROLAR_SKIP_SERVER_INSTALL === '1') {
        throw new Error(
            `Backend dependencies are missing (${missingModules.join(', ')}). ` +
            'Run "npm run server:install" and try dev:tunnel again.'
        );
    }

    log('server', colors.yellow, `Backend dependencies missing (${missingModules.join(', ')}).`);
    log('server', colors.yellow, 'Installing server dependencies with npm install in ./server...');

    const installCommand = resolveSpawnCommand('npm', ['install', '--include=dev']);
    const result = spawnSync(installCommand.command, installCommand.args, {
        cwd: SERVER_DIR,
        env: process.env,
        stdio: 'inherit',
        shell: false,
        windowsHide: true,
    });

    if (result.error) {
        throw new Error(`Could not run npm install in ./server: ${result.error.message}`);
    }

    if (result.status !== 0) {
        throw new Error(
            `npm install in ./server failed (code ${result.status}). ` +
            'Run "npm run server:install" and try dev:tunnel again.'
        );
    }
}

function hasEnvValue(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function hasEnvKey(fileEnv, key) {
    return hasEnvValue(process.env[key]) || hasEnvValue(fileEnv[key]);
}

function isEnvGroupConfigured(fileEnv, group) {
    return group.options.some((option) => option.every((key) => hasEnvKey(fileEnv, key)));
}

function describeEnvGroupOptions(group) {
    return group.options.map((option) => option.join(' + ')).join(' or ');
}

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};

    const source = fs.readFileSync(filePath, 'utf8');

    try {
        const dotenvPath = require.resolve('dotenv', { paths: [SERVER_DIR] });
        const dotenv = require(dotenvPath);
        return dotenv.parse(source);
    } catch {
        const parsed = {};

        source.split(/\r?\n/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
            if (!match) return;

            parsed[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        });

        return parsed;
    }
}

function getServerEnvironmentOverrides() {
    const rootEnv = parseEnvFile(ROOT_ENV_FILE);
    const serverEnv = parseEnvFile(SERVER_ENV_FILE);
    const fileEnv = { ...rootEnv, ...serverEnv };

    const missingKeys = SERVER_REQUIRED_ENV_KEYS.filter((key) => (
        !hasEnvValue(process.env[key]) && !hasEnvValue(fileEnv[key])
    ));

    if (Object.keys(rootEnv).length > 0 && !fs.existsSync(SERVER_ENV_FILE)) {
        log('server', colors.dim, 'Using values from root .env for the backend process.');
    }

    if (missingKeys.length > 0) {
        log(
            'server',
            colors.yellow,
            `Missing backend env ${missingKeys.join(', ')}. Using dev placeholders so the local API can boot.`
        );
        log('server', colors.yellow, 'Pluggy endpoints still need real values in server/.env for bank flows.');
    }

    SERVER_IMPORTANT_ENV_GROUPS
        .filter((group) => !isEnvGroupConfigured(fileEnv, group))
        .forEach((group) => {
            log(
                'server',
                colors.yellow,
                `Missing ${group.label} env (${describeEnvGroupOptions(group)}). ${group.impact}`
            );
        });

    return {
        ...fileEnv,
        ...Object.fromEntries(
            missingKeys.map((key) => [key, DEV_PLACEHOLDER_ENV[key] || `dev-tunnel-missing-${key.toLowerCase()}`])
        ),
    };
}

function stopProcess(proc) {
    if (!proc || proc.killed) return;

    try {
        if (process.platform === 'win32' && proc.pid) {
            execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' });
            return;
        }

        proc.kill('SIGTERM');
    } catch {
        try {
            proc.kill('SIGTERM');
        } catch {
            // Already stopped.
        }
    }
}

function pipeOutput(proc, tag, color, stderrColor = colors.yellow, onLine) {
    const writeLines = (data, lineColor) => {
        data.toString().split(/\r?\n/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            log(tag, lineColor, trimmed);
            onLine?.(trimmed);
        });
    };

    proc.stdout.on('data', (data) => writeLines(data, color));
    proc.stderr.on('data', (data) => writeLines(data, stderrColor));
}

function summarizeOutput(output) {
    return output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-4)
        .join(' | ');
}

function startTunnel(port, tag, label, processes, onUnexpectedExit) {
    return new Promise((resolve, reject) => {
        log(tag, colors.cyan, `Opening Cloudflare tunnel for ${label} on localhost:${port}...`);

        const proc = spawnProcess('cloudflared', [
            'tunnel',
            '--no-autoupdate',
            '--url',
            `http://localhost:${port}`,
        ]);
        processes.push(proc);

        let resolved = false;
        let outputBuffer = '';

        const handleOutput = (data) => {
            const output = data.toString();
            outputBuffer = (outputBuffer + output).slice(-4000);

            const match = output.match(TUNNEL_URL_PATTERN);
            if (match && !resolved) {
                resolved = true;
                const url = normalizeBaseUrl(match[0]);
                log(tag, colors.green, `${label} tunnel ready: ${url}`);
                resolve({ url, proc });
            }
        };

        proc.stdout.on('data', handleOutput);
        proc.stderr.on('data', handleOutput);

        proc.once('error', (err) => {
            if (!resolved) reject(err);
        });

        proc.once('close', (code) => {
            if (!resolved) {
                const tail = summarizeOutput(outputBuffer);
                const details = tail ? ` Last output: ${tail}` : '';
                reject(new Error(`cloudflared closed before opening ${label} tunnel (code ${code}).${details}`));
                return;
            }

            if (!isShuttingDown) {
                log(tag, colors.red, `${label} tunnel closed`);
                onUnexpectedExit?.(1);
            }
        });
    });
}

function requestHttpStatus(url, timeoutMs = 1500) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: timeoutMs }, (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode || 0));
        });

        req.once('timeout', () => {
            req.destroy(new Error('timeout'));
        });

        req.once('error', reject);
    });
}

async function waitForHttp(url, tag, label, timeoutMs = 45000) {
    const startedAt = Date.now();
    let lastError = null;

    while (Date.now() - startedAt < timeoutMs) {
        try {
            const status = await requestHttpStatus(url);
            if (status >= 200 && status < 500) {
                log(tag, colors.green, `${label} is responding at ${url}`);
                return;
            }
        } catch (err) {
            lastError = err;
        }

        await delay(800);
    }

    const suffix = lastError instanceof Error ? ` (${lastError.message})` : '';
    throw new Error(`${label} did not respond at ${url}${suffix}`);
}

function serializeMetroMessage(message) {
    return JSON.stringify({
        ...message,
        version: 2,
    });
}

function sendMetroCommand(method, params) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${METRO_PORT}/message`, {
            handshakeTimeout: 1500,
        });
        let settled = false;

        const timeout = setTimeout(() => {
            settled = true;
            ws.terminate();
            reject(new Error('Metro did not answer the command.'));
        }, 2500);

        const finish = (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                try {
                    ws.close();
                } catch {
                    // Ignore close errors.
                }
            }
            err ? reject(err) : resolve();
        };

        ws.once('open', () => {
            ws.send(serializeMetroMessage({ method, params }), finish);
        });

        ws.once('error', finish);
    });
}

function reloadApp(expoProc) {
    log('reload', colors.green, 'Reloading the app...');
    sendMetroCommand('reload').catch((err) => {
        log('reload', colors.yellow, `Metro reload failed: ${err.message}. Forwarding "r" to Expo CLI.`);
        try {
            expoProc.stdin.write('r');
        } catch {
            // The Expo process may have exited.
        }
    });
}

function buildExpoArgs(rawArgs) {
    const forwarded = [];

    for (let index = 0; index < rawArgs.length; index += 1) {
        const arg = rawArgs[index];

        if (arg === '--tunnel' || arg === '--lan' || arg === '--localhost') continue;

        if (arg === '--host' || arg === '-m' || arg === '--port' || arg === '-p') {
            index += 1;
            continue;
        }

        forwarded.push(arg);
    }

    const hasStartTargetArg = forwarded.some((arg) => (
        arg === '--go' ||
        arg === '-g' ||
        arg === '--dev-client' ||
        arg === '-d'
    ));

    const expoArgs = ['expo', 'start'];
    if (!hasStartTargetArg) expoArgs.push('--dev-client');

    expoArgs.push('--localhost', '--port', String(METRO_PORT));
    expoArgs.push(...forwarded);

    return expoArgs;
}

function startBackend(apiTunnelUrl, serverEnvOverrides, processes, onUnexpectedExit) {
    log('server', colors.blue, 'Starting local backend...');

    const proc = spawnProcess('npm', ['--prefix', 'server', 'run', 'dev'], {
        env: {
            ...serverEnvOverrides,
            ...process.env,
            PORT: String(SERVER_PORT),
            PUBLIC_BASE_URL: apiTunnelUrl,
        },
    });
    processes.push(proc);

    pipeOutput(proc, 'server', colors.blue);
    proc.once('exit', (code) => {
        if (isShuttingDown) return;
        log('server', colors.red, `Backend exited (code ${code})`);
        onUnexpectedExit?.(1);
    });

    return proc;
}

function startExpo(metroTunnelUrl, apiTunnelUrl, iapApiUrl, expoArgs, processes, onUnexpectedExit, onReadyLine) {
    log('expo', colors.green, `Starting Expo: npx ${expoArgs.join(' ')}`);
    log('expo', colors.green, `Injecting EXPO_PUBLIC_API_URL=${apiTunnelUrl}`);
    log('expo', colors.green, `Injecting EXPO_PUBLIC_IAP_API_URL=${iapApiUrl}`);

    const proc = spawnProcess('npx', expoArgs, {
        env: {
            ...process.env,
            EXPO_PACKAGER_PROXY_URL: metroTunnelUrl,
            CONTROLAR_KEEP_PACKAGER_PROXY: '1',
            EXPO_PUBLIC_API_URL: apiTunnelUrl,
            EXPO_PUBLIC_IAP_API_URL: iapApiUrl,
        },
    });
    processes.push(proc);

    pipeOutput(proc, 'expo', colors.green, colors.magenta, (line) => {
        if (
            line.includes('Waiting on') ||
            line.includes('Metro waiting on') ||
            line.includes('Logs for your project')
        ) {
            onReadyLine?.();
        }
    });

    proc.once('exit', (code) => {
        if (isShuttingDown) return;
        log('expo', colors.red, `Expo exited (code ${code})`);
        onUnexpectedExit?.(1);
    });

    return { proc, expoArgs };
}

function showReadyInfo(metroTunnelUrl, apiTunnelUrl, iapApiUrl, expoArgs) {
    const metroHost = metroTunnelUrl.replace(/^https?:\/\//, '');
    const expoUrl = `exp://${metroHost}`;

    console.log('');
    console.log(`${colors.bold}${colors.green}ControlarApp dev:tunnel is ready${colors.reset}`);
    console.log('');

    qrcode.generate(expoUrl, { small: true }, (code) => {
        console.log(code);
    });

    console.log('');
    console.log(`${colors.cyan}Expo URL:          ${colors.bold}${expoUrl}${colors.reset}`);
    console.log(`${colors.cyan}Metro tunnel:      ${colors.bold}${metroTunnelUrl}${colors.reset}`);
    console.log(`${colors.cyan}API tunnel:        ${colors.bold}${apiTunnelUrl}${colors.reset}`);
    console.log(`${colors.cyan}Local Metro:       http://127.0.0.1:${METRO_PORT}${colors.reset}`);
    console.log(`${colors.cyan}Local API:         http://127.0.0.1:${SERVER_PORT}${colors.reset}`);
    console.log(`${colors.cyan}Backend public:    PUBLIC_BASE_URL=${apiTunnelUrl}${colors.reset}`);
    console.log(`${colors.cyan}App API env:       EXPO_PUBLIC_API_URL=${apiTunnelUrl}${colors.reset}`);
    console.log(`${colors.cyan}IAP API env:       EXPO_PUBLIC_IAP_API_URL=${iapApiUrl}${colors.reset}`);
    console.log(`${colors.dim}Expo command:      npx ${expoArgs.join(' ')}${colors.reset}`);
    console.log(`${colors.dim}Shortcuts: r reload | q quit | Ctrl+C quit${colors.reset}`);
    console.log('');
}

function attachKeyboard(expoProc, cleanupFn) {
    if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
    }

    process.stdin.resume();
    process.stdin.on('data', (key) => {
        if (key[0] === 3) {
            cleanupFn(0);
            return;
        }

        const input = key.toString().trim().toLowerCase();

        if (input === 'q') {
            cleanupFn(0);
            return;
        }

        if (input === 'r') {
            reloadApp(expoProc);
            return;
        }

        try {
            expoProc.stdin.write(key);
        } catch {
            // The Expo process may have exited.
        }
    });
}

function cleanup(processes, exitCode = 0) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log('cleanup', colors.yellow, 'Stopping dev:tunnel processes...');

    if (process.stdin.setRawMode) {
        try {
            process.stdin.setRawMode(false);
        } catch {
            // Ignore TTY cleanup errors.
        }
    }

    processes.forEach(stopProcess);
    setTimeout(() => process.exit(exitCode), 500);
}

async function main() {
    const rawArgs = process.argv.slice(2);
    const processes = [];
    const cleanupAndExit = (exitCode = 0) => cleanup(processes, exitCode);

    printHeader(rawArgs);

    try {
        ensureServerDependencies();
        const serverEnvOverrides = getServerEnvironmentOverrides();

        log('cleanup', colors.yellow, `Freeing ports ${METRO_PORT} and ${SERVER_PORT} if needed...`);
        killPort(METRO_PORT);
        killPort(SERVER_PORT);
        await delay(800);

        const [apiTunnel, metroTunnel] = await Promise.all([
            startTunnel(SERVER_PORT, 'api', 'API', processes, cleanupAndExit),
            startTunnel(METRO_PORT, 'metro', 'Metro', processes, cleanupAndExit),
        ]);

        startBackend(apiTunnel.url, serverEnvOverrides, processes, cleanupAndExit);
        await waitForHttp(LOCAL_API_HEALTH_URL, 'server', 'Local backend');

        const expoArgs = buildExpoArgs(rawArgs);
        const iapApiUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_IAP_API_URL || DEFAULT_PRODUCTION_API_URL);
        let readyPrinted = false;
        const printReadyOnce = () => {
            if (readyPrinted) return;
            readyPrinted = true;
            showReadyInfo(metroTunnel.url, apiTunnel.url, iapApiUrl, expoArgs);
        };

        const { proc: expoProc } = startExpo(
            metroTunnel.url,
            apiTunnel.url,
            iapApiUrl,
            expoArgs,
            processes,
            cleanupAndExit,
            printReadyOnce
        );

        waitForHttp(METRO_STATUS_URL, 'metro', 'Metro').then(printReadyOnce).catch((err) => {
            log('metro', colors.yellow, `Metro status check timed out: ${err.message}`);
        });

        attachKeyboard(expoProc, cleanupAndExit);
        process.once('SIGINT', () => cleanupAndExit(0));
        process.once('SIGTERM', () => cleanupAndExit(0));
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log('error', colors.red, `Failed to start dev:tunnel: ${message}`);
        cleanupAndExit(1);
    }
}

main();
