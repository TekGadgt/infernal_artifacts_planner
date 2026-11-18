#!/usr/bin/env node
// Builds the site, serves it locally, and opens a Cloudflare quick tunnel so
// someone else can see it. The public URL lasts until you press Ctrl+C.
// Needs cloudflared: `brew install cloudflared`.

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASTRO = join(ROOT, 'node_modules/astro/bin/astro.mjs');

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer().once('error', reject);
    srv.listen(0, 'localhost', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const build = spawnSync(process.execPath, [ASTRO, 'build'], { cwd: ROOT, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const port = await freePort();

// --ignore-lock keeps this server in the foreground and out of Astro's lock file.
// Without it, Astro moves preview into a detached background process when it
// thinks an AI agent is running it, and that process outlives this script.
const preview = spawn(process.execPath, [ASTRO, 'preview', '--port', String(port), '--ignore-lock'], {
  cwd: ROOT,
  stdio: ['ignore', 'ignore', 'inherit'],
});
const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], {
  stdio: ['ignore', 'ignore', 'pipe'],
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  preview.kill();
  tunnel.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

preview.on('exit', (code) => {
  if (!stopping) console.error(`The preview server stopped (exit code ${code}).`);
  stop(code ?? 1);
});
tunnel.on('error', (err) => {
  console.error(err.code === 'ENOENT' ? 'cloudflared is not installed. Run: brew install cloudflared' : err.message);
  stop(1);
});
tunnel.on('exit', (code) => {
  if (!stopping) console.error(`cloudflared stopped (exit code ${code}).`);
  stop(code ?? 1);
});

// cloudflared prints the public URL to stderr.
let announced = false;
tunnel.stderr.on('data', (chunk) => {
  const url = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (url && !announced) {
    announced = true;
    console.log(`\n  Share this link: ${url}\n  Serving the build from localhost:${port}. Press Ctrl+C to stop.\n`);
  }
});
