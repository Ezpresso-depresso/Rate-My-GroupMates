import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const launcher = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/start-afterparty.mjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function launch(port) {
  const child = spawn(process.execPath, [launcher, '--port', String(port), '--no-open'], {
    cwd: tmpdir(), windowsHide: true,
    env: { ...process.env, PATH: `${dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}` },
  });
  let output = '';
  child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  return { child, output: () => output, finished: new Promise(resolve => child.on('exit', code => resolve(code))) };
}
async function until(predicate, output) {
  for (let attempt = 0; attempt < 100; attempt++) { if (predicate()) return; await delay(100); }
  assert.fail(`Launcher did not reach expected state:\n${output()}`);
}

test('launcher works from another folder, reuses a running server, and restarts after closing', { timeout: 40_000 }, async t => {
  const reserved = createServer(); await new Promise(resolve => reserved.listen(0, '127.0.0.1', resolve));
  const port = reserved.address().port; await new Promise(resolve => reserved.close(resolve));
  const processes = [];
  t.after(() => { processes.forEach(p => p.child.kill()); });
  const first = launch(port); processes.push(first);
  await until(() => first.output().includes('Local preview ready:'), first.output);
  assert.equal((await fetch(`http://127.0.0.1:${port}/dev/afterparty.html`)).status, 200);
  assert.equal((await (await fetch(`http://127.0.0.1:${port}/__afterparty_preview/status`)).json()).app, 'rmg-afterparty-preview');
  const second = launch(port); processes.push(second);
  await until(() => second.child.exitCode !== null, second.output);
  assert.equal(await second.finished, 0); assert.match(second.output(), /Already running/);
  if (process.platform === 'win32') {
    const wrapper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(dirname(launcher), '../start-afterparty.ps1'), '-Port', String(port), '-NoOpen'], {
      cwd: tmpdir(), windowsHide: true, env: { ...process.env, PATH: process.env.PATH.split(';').filter(p => p.toLowerCase() !== dirname(process.execPath).toLowerCase()).join(';') },
    });
    let output = '';
    wrapper.stdout.on('data', data => { output += data; }); wrapper.stderr.on('data', data => { output += data; });
    t.after(() => wrapper.kill());
    await until(() => wrapper.exitCode !== null, () => output);
    assert.equal(wrapper.exitCode, 0, output); assert.match(output, /Already running/);
  }
  assert.equal(first.child.kill(), true);
  await until(() => first.child.exitCode !== null || first.child.signalCode !== null, first.output);
  await first.finished;
  const third = launch(port); processes.push(third);
  await until(() => third.output().includes('Local preview ready:'), third.output);
  assert.equal((await fetch(`http://127.0.0.1:${port}/dev/afterparty.html`)).status, 200);
});

test('launcher skips an occupied port without stopping the other application', { timeout: 25_000 }, async t => {
  const occupied = createServer(socket => socket.end('HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nother'));
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  t.after(() => occupied.close());
  const port = occupied.address().port;
  const preview = launch(port); t.after(() => preview.child.kill());
  await until(() => preview.output().includes('Local preview ready:'), preview.output);
  assert.match(preview.output(), new RegExp(`Port ${port} is occupied`));
  const selected = preview.output().match(/Local preview ready: (http:\/\/[^\s]+)/)[1];
  assert.equal((await fetch(selected)).status, 200);
  assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(), 'other');
});
