#!/usr/bin/env node

/**
 * dev-tunnel.js
 *
 * Script alternativo ao `expo start --tunnel` que substitui o ngrok (v2 descontinuado)
 * por cloudflared (muito mais rápido e estável que localtunnel). Inicia:
 *   1. O tunnel via cloudflared na porta 8081
 *   2. O servidor backend (nodemon)
 *   3. O Expo Metro Bundler com a URL do tunnel
 *   4. Gera QR code para abrir no Expo Go
 */

const { spawn, execSync } = require('child_process');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const METRO_PORT = 8081;
const SERVER_PORT = 3001;

// ---------------------------------------------------------------------------
// Mata todos os processos que estejam usando uma porta (Windows)
// ---------------------------------------------------------------------------

function killPort(port) {
    try {
        const output = execSync('netstat -ano', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const pids = new Set();
        output.split('\n').forEach(line => {
            // Procura por ":PORT " ou ":PORT\r" para evitar falsos positivos (ex: :80810)
            if (new RegExp(`:${port}[\\s\\r]`).test(line)) {
                const match = line.trim().match(/(\d+)\s*$/);
                if (match && match[1] !== '0') {
                    pids.add(match[1]);
                }
            }
        });
        if (pids.size === 0) return;
        pids.forEach(pid => {
            try {
                execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                log('cleanup', colors.yellow, `Processo PID ${pid} encerrado (porta ${port})`);
            } catch {
                // Pode falhar se o processo já morreu — ignora
            }
        });
    } catch {
        // netstat falhou ou nenhum processo encontrado — ignora
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAppSlug() {
    try {
        const appJsonPath = path.join(process.cwd(), 'app.json');
        const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
        return appJson.expo?.slug || 'controlarapp';
    } catch {
        return 'controlarapp';
    }
}

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

function log(tag, color, msg) {
    console.log(`${color}[${tag}]${colors.reset} ${msg}`);
}

function startTunnel(port, tag) {
    return new Promise((resolve, reject) => {
        log(tag, colors.cyan, `Criando tunnel cloudflare na porta ${port}...`);

        const tunnel = spawnProcess('cloudflared', ['tunnel', '--url', `http://localhost:${port}`]);
        let resolved = false;

        tunnel.stderr.on('data', (data) => {
            const output = data.toString();
            const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);

            if (match && !resolved) {
                resolved = true;
                const url = match[0];
                log(tag, colors.green, `✅ Tunnel ativo: ${url}`);
                resolve({
                    url: url,
                    close: () => tunnel.kill('SIGTERM')
                });
            }
        });

        tunnel.on('close', () => {
            if (!resolved) reject(new Error("O cloudflared não abriu o tunnel. Verifique se tem instâncias rodando."));
            log(tag, colors.red, '❌ Tunnel fechado');
        });

        tunnel.on('error', (err) => {
            if (!resolved) reject(err);
            log(tag, colors.red, `❌ Erro no tunnel: ${err.message}`);
        });
    });
}

function spawnProcess(command, args, options = {}) {
    const proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        ...options,
    });

    return proc;
}

function showQRCode(tunnelUrl) {
    const tunnelHost = tunnelUrl.replace('https://', '').replace('http://', '');
    const expoUrl = `exp://${tunnelHost}`;

    console.log('');
    console.log(`${colors.bold}${colors.green}  ══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}${colors.green}  📱 Escaneie o QR Code com o Expo Go:${colors.reset}`);
    console.log(`${colors.bold}${colors.green}  ══════════════════════════════════════════════${colors.reset}`);
    console.log('');

    qrcode.generate(expoUrl, { small: true }, (code) => {
        console.log(code);
    });

    console.log('');
    console.log(`${colors.cyan}  URL Expo Go: ${colors.bold}${expoUrl}${colors.reset}`);
    console.log(`${colors.cyan}  Tunnel URL:  ${colors.bold}${tunnelUrl}${colors.reset}`);
    console.log(`${colors.dim}  (Ou digite a URL manualmente no Expo Go)${colors.reset}`);
    console.log('');
    console.log(`${colors.green}  ══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}  📦 Metro:    http://localhost:${METRO_PORT}${colors.reset}`);
    console.log(`${colors.blue}  🖥️  Server:   http://localhost:${SERVER_PORT}${colors.reset}`);
    console.log(`${colors.green}  ══════════════════════════════════════════════${colors.reset}`);
    console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const processes = [];

    try {
        // 0. Liberar portas que possam estar ocupadas por sessões anteriores
        log('cleanup', colors.yellow, `Liberando portas ${METRO_PORT} e ${SERVER_PORT}...`);
        killPort(METRO_PORT);
        killPort(SERVER_PORT);

        // Aguarda os processos mortos liberarem as portas
        await new Promise(r => setTimeout(r, 800));

        // 1. Criar tunnel para o Metro Bundler
        const metroTunnel = await startTunnel(METRO_PORT, 'tunnel');

        // 2. Iniciar o servidor backend
        log('server', colors.blue, 'Iniciando servidor backend...');
        const serverProc = spawnProcess('npm', ['run', 'server:dev'], {
            cwd: process.cwd(),
            env: { ...process.env },
        });
        processes.push(serverProc);

        serverProc.stdout.on('data', (data) => {
            data.toString().trim().split('\n').forEach(line => {
                if (line.trim()) log('server', colors.blue, line.trim());
            });
        });
        serverProc.stderr.on('data', (data) => {
            data.toString().trim().split('\n').forEach(line => {
                if (line.trim()) log('server', colors.yellow, line.trim());
            });
        });
        serverProc.on('exit', (code) => {
            log('server', colors.red, `Processo encerrado (code: ${code})`);
        });

        // 3. Iniciar o Expo com a URL do tunnel
        log('expo', colors.green, 'Iniciando Expo Metro Bundler...');

        const expoProc = spawnProcess('npx', ['expo', 'start', '--lan', '--port', String(METRO_PORT)], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                EXPO_PACKAGER_PROXY_URL: metroTunnel.url,
            },
        });
        processes.push(expoProc);

        let metroReady = false;

        expoProc.stdout.on('data', (data) => {
            data.toString().trim().split('\n').forEach(line => {
                if (line.trim()) {
                    log('expo', colors.green, line.trim());

                    // Quando o Metro estiver pronto, mostra o QR code
                    if (!metroReady && (line.includes('Waiting on') || line.includes('Logs for your project'))) {
                        metroReady = true;
                        showQRCode(metroTunnel.url);
                    }
                }
            });
        });
        expoProc.stderr.on('data', (data) => {
            data.toString().trim().split('\n').forEach(line => {
                if (line.trim()) log('expo', colors.magenta, line.trim());
            });
        });
        expoProc.on('exit', (code) => {
            log('expo', colors.red, `Processo encerrado (code: ${code})`);
            cleanup(processes, metroTunnel);
        });

        // Forward stdin para o expo (para comandos como 'r', 'a', etc.)
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        process.stdin.on('data', (key) => {
            // Ctrl+C
            if (key[0] === 3) {
                cleanup(processes, metroTunnel);
                return;
            }
            // 'q' para sair
            if (key.toString() === 'q') {
                cleanup(processes, metroTunnel);
                return;
            }
            expoProc.stdin.write(key);
        });

        // Cleanup on exit
        process.on('SIGINT', () => cleanup(processes, metroTunnel));
        process.on('SIGTERM', () => cleanup(processes, metroTunnel));

    } catch (err) {
        log('error', colors.red, `❌ Falha ao iniciar: ${err.message}`);
        cleanup(processes, null);
        process.exit(1);
    }
}

function cleanup(processes, tunnel) {
    log('info', colors.yellow, 'Encerrando processos...');

    processes.forEach(proc => {
        try { proc.kill('SIGTERM'); } catch {}
    });

    if (tunnel) {
        try { tunnel.close(); } catch {}
    }

    setTimeout(() => process.exit(0), 500);
}

main();
