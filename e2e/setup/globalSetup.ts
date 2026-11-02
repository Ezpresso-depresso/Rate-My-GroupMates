/*
 * Starts everything the browser tests need, fresh for every run:
 *   1. a throwaway MongoDB (mongodb-memory-server downloads it on first run; nothing to install)
 *   2. the real backend (backend/src/server.ts) with the local test login enabled
 *   3. the real frontend (Vite dev server) pointed at that backend
 * and shuts it all down afterwards. Your own backend/.env and database are never touched.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import type { TestProject } from 'vitest/node';

// APP_ROOT lets the suite run against another checkout (e.g. an older commit).
const ROOT = process.env.APP_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LOG_DIR = join(ROOT, 'e2e', '.logs');

declare module 'vitest' {
  export interface ProvidedContext {
    appUrl: string;
    apiUrl: string;
  }
}

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const srv = createServer();
    srv.once('error', fail);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => ok(port));
    });
  });
}

function requireInstalled(dir: string) {
  if (!existsSync(join(ROOT, dir, 'node_modules')))
    throw new Error(`Run \`npm install\` in ${dir}/ first (the tests start the real ${dir}).`);
}

function start(name: string, command: string, args: string[], cwd: string, env: Record<string, string>) {
  const log: string[] = [];
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, detached: true });
  child.stdout?.on('data', (d) => log.push(String(d)));
  child.stderr?.on('data', (d) => log.push(String(d)));
  const save = () => writeFileSync(join(LOG_DIR, `${name}.log`), log.join(''));
  return { child, log, save };
}

async function waitFor(what: string, check: () => Promise<boolean>, logs: string[], timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await check().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${what} didn't start within ${timeoutMs / 1000}s. Its output:\n${logs.join('').slice(-3000)}`);
}

function stop(child: ChildProcess) {
  if (child.pid && child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGTERM'); // the whole process group (npx/tsx/vite spawn children)
    } catch {
      child.kill('SIGTERM');
    }
  }
}

export default async function setup(project: TestProject) {
  requireInstalled('backend');
  requireInstalled('frontend');
  mkdirSync(LOG_DIR, { recursive: true });

  const mongo = await MongoMemoryServer.create();
  const [apiPort, appPort] = [await freePort(), await freePort()];
  const appUrl = `http://localhost:${appPort}`;
  const apiUrl = `http://localhost:${apiPort}/api`;

  const backend = start('backend', join(ROOT, 'backend/node_modules/.bin/tsx'), ['src/server.ts'], join(ROOT, 'backend'), {
    PORT: String(apiPort),
    NODE_ENV: 'test',
    MONGODB_URI: mongo.getUri(),
    MONGODB_DB_NAME: 'rmg-e2e',
    CLIENT_ORIGIN: appUrl,
    DEV_LOGIN: 'true',
    GOOGLE_CLIENT_ID: '',
    JWT_SECRET: 'e2e-secret',
  });
  const frontend = start(
    'frontend',
    join(ROOT, 'frontend/node_modules/.bin/vite'),
    ['--port', String(appPort), '--strictPort', '--host', 'localhost'],
    join(ROOT, 'frontend'),
    { VITE_API_URL: apiUrl, VITE_LOBBY_POLL_MS: '1000' },
  );

  const teardown = async () => {
    backend.save();
    frontend.save();
    stop(backend.child);
    stop(frontend.child);
    await mongo.stop();
  };

  try {
    await waitFor(
      'The backend',
      async () => (await (await fetch(`${apiUrl}/health`)).json()).db === 'connected',
      backend.log,
    );
    await waitFor('The frontend', async () => (await fetch(appUrl)).ok, frontend.log);
  } catch (err) {
    await teardown();
    throw err;
  }

  project.provide('appUrl', appUrl);
  project.provide('apiUrl', apiUrl);
  return teardown;
}
