import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer as createTCPServer } from 'node:net';
import { createServer } from 'vite';
import { DEMO_API_PATH, DEMO_TEAM_ID, localDemoPlugin } from './local-demo-api.mjs';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const identity = createHash('sha256').update(root).digest('hex');
const args = process.argv.slice(2);
const index = args.indexOf('--port');
const firstPort = index < 0 ? 5173 : Number(args[index + 1]);
const noOpen = args.includes('--no-open');
if (!Number.isInteger(firstPort) || firstPort < 1024 || firstPort > 65515) {
  console.error('Choose a port between 1024 and 65515.'); process.exit(1);
}

function openBrowser(url) {
  if (noOpen) return;
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const parameters = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  const browser = spawn(command, parameters, { stdio: 'ignore', windowsHide: true });
  browser.on('error', () => console.log(`Open this address in your browser: ${url}`));
  browser.unref();
}

async function portAvailability(port) {
  return new Promise(resolve => {
    const probe = createTCPServer();
    probe.once('error', error => resolve(error.code));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(null)));
  });
}

let started = false;
for (let port = firstPort; port < firstPort + 20; port++) {
  const origin = `http://127.0.0.1:${port}`;
  const url = `${origin}/?start=1`;
  try {
    const response = await fetch(`${origin}/__afterparty_preview/status`, { signal: AbortSignal.timeout(700) });
    const status = await response.json();
    if (status.app === 'rmg-afterparty-preview' && status.identity === identity && status.flowVersion === 2) {
      console.log(`Already running. Reusing preview: ${url}`);
      console.log('Keep the original server window open.');
      openBrowser(url); process.exit(0);
    }
  } catch { /* Unused port, or a different app. Never stop its process. */ }

  const unavailable = await portAvailability(port);
  if (unavailable) {
    console.log(`Port ${port} is ${unavailable === 'EADDRINUSE' ? 'occupied' : `unavailable (${unavailable})`}; trying ${port + 1}.`);
    continue;
  }
  const server = await createServer({ root, configFile: resolve(root, 'vite.config.ts'),
    cacheDir: resolve(root, 'node_modules/.vite-afterparty-preview', String(port)),
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify(DEMO_API_PATH), 'import.meta.env.VITE_TEAM_ID': JSON.stringify(DEMO_TEAM_ID) },
    server: { host: '127.0.0.1', port, strictPort: true, open: false }, clearScreen: false,
    plugins: [localDemoPlugin(), { name: 'afterparty-preview-identity', configureServer(vite) {
      // Must be registered before Vite's HTML fallback, otherwise a repeat launch
      // receives index.html instead of this JSON and cannot recognize its server.
      vite.middlewares.use('/__afterparty_preview/status', (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({ app: 'rmg-afterparty-preview', identity, flowVersion: 2 }));
      });
    } }],
  });
  try { await server.listen(); }
  catch (error) {
    await server.close();
    if (error.code === 'EADDRINUSE' || /already in use/.test(error.message)) {
      console.log(`Port ${port} is occupied; trying ${port + 1}.`); continue;
    }
    throw error;
  }
  console.log(`Local preview ready: ${url}`);
  started = true;
  console.log('Full original flow: choose member -> rate teammates -> awards -> optional afterparty.');
  console.log('Fictional local data only. No real database connection.');
  console.log('Keep this window open while playing. Press Ctrl+C to stop. Run the launcher again to reopen.');
  const stop = async () => { await server.close(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  openBrowser(url);
  // The HTTP server keeps this process alive; one server owns this preview.
  break;
}
if (!started) {
  console.error(`No available preview port between ${firstPort} and ${firstPort + 19}. Try -Port 5200.`);
  process.exit(1);
}
