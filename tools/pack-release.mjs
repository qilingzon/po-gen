// pack-release.mjs — build the release zip + SHA256SUMS.txt exactly like previous releases.
//
// Output layout (unchanged since 0.5.x): the archive root holds one folder `po-gen/`
// containing the files listed in package.json#files plus package.json itself.
//
// Usage: node tools/pack-release.mjs [--out dist]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

const outIdx = process.argv.indexOf('--out');
const dist = path.resolve(root, outIdx >= 0 ? process.argv[outIdx + 1] : 'dist');
fs.mkdirSync(dist, { recursive: true });

const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'po-gen-pack-'));
const stage = path.join(stageRoot, 'po-gen');
fs.mkdirSync(stage, { recursive: true });

const wanted = new Set(['package.json', ...(pkg.files || [])]);
for (const entry of wanted) {
  const src = path.join(root, entry);
  if (!fs.existsSync(src)) {
    console.warn('warn: listed in files but missing: ' + entry);
    continue;
  }
  const dst = path.join(stage, entry);
  fs.cpSync(src, dst, { recursive: true, filter: (s) => !s.includes('node_modules') });
}

const zipName = 'po-gen-' + version + '.zip';
const zipPath = path.join(dist, zipName);
if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
execFileSync(tar, ['--format', 'zip', '-cf', zipPath, '-C', stageRoot, 'po-gen'], { stdio: 'inherit' });

const digest = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
const sums = digest + '  ' + zipName + '\n';
const sumsPath = path.join(dist, 'SHA256SUMS.txt');
fs.writeFileSync(sumsPath, sums);

fs.rmSync(stageRoot, { recursive: true, force: true });
console.log('PACK-OK ' + zipPath);
console.log('sha256    ' + digest);
console.log('sums      ' + sumsPath);
