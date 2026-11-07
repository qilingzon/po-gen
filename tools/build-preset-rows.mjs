// build-preset-rows.mjs — regenerate preset-rows.js from the HOST THAT IS ACTUALLY INSTALLED.
//
// Why this exists (0.5.73): 0.5.72 shipped a roster generated from a stale
// extraction of dsh-web-app/presets/standard.patch.yml (host 0.2.1). When the
// desktop host updated to 0.2.2-rc.1, two rows in that stale roster stopped
// resolving:
//   - @deepseek-ai/dsh-tool-subagent-control/list-agents  (subpath removed)
//   - tool-subagent config key `modelSelectionSettings`   (renamed to
//     modelSelection/modelDiscovery)
// `agentPresets.register()` does NOT validate imports, so the plugin still
// reported "preset-registered: full"; the failure only surfaced later, when the
// registry's activation audit rejected the definition and every armor session
// became "会话不可用".
//
// This tool reads the roster out of the installed app.asar, expands it, appends
// the po-gen self row, and REFUSES to write output unless every module specifier
// (including the nested group children) resolves against that same asar's
// package `exports` maps. Drift can no longer ship silently.
//
// Usage:
//   node tools/build-preset-rows.mjs [--asar <path>] [--out <path>] [--check]
//   --check   validate the current preset-rows.js against the installed host
//             without rewriting it (exit 1 on any unresolvable row)

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const defaultAsar = 'D:/deepseek/DeepSeek Harness/resources/app.asar';

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const asarPath = arg('asar', process.env.DSH_ASAR || defaultAsar);
const outPath = arg('out', path.join(pkgRoot, 'preset-rows.js'));
const checkOnly = process.argv.includes('--check');

// ---------------------------------------------------------------- asar reader
function openAsar(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  const headerSize = head.readUInt32LE(4);
  const headerBuf = Buffer.alloc(headerSize);
  fs.readSync(fd, headerBuf, 0, headerSize, 8);
  const jsonLen = headerBuf.readUInt32LE(4);
  const header = JSON.parse(headerBuf.toString('utf8', 8, 8 + jsonLen));
  const dataStart = 8 + headerSize;
  return {
    read(filePath) {
      const parts = filePath.split('/').filter(Boolean);
      let node = header;
      for (const part of parts) {
        if (!node.files || !node.files[part]) return null;
        node = node.files[part];
      }
      if (node.files) return null;
      const buf = Buffer.alloc(node.size);
      fs.readSync(fd, buf, 0, node.size, dataStart + Number(node.offset));
      return buf.toString('utf8');
    },
    close() { fs.closeSync(fd); },
  };
}

// ------------------------------------------------------- module spec checking
function splitSpecifier(spec) {
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return { pkg: parts.slice(0, 2).join('/'), sub: parts.slice(2).join('/') };
  }
  const [pkg, ...rest] = spec.split('/');
  return { pkg, sub: rest.join('/') };
}

function makeResolver(asar, profileModules) {
  return function resolves(spec) {
    if (!spec || spec.startsWith('cordis:')) return { ok: true, why: 'special' };
    const { pkg, sub } = splitSpecifier(spec);
    let pkgJson = asar.read('/dsh/node_modules/' + pkg + '/package.json');
    if (!pkgJson) {
      const disk = path.join(profileModules, pkg, 'package.json');
      if (fs.existsSync(disk)) pkgJson = fs.readFileSync(disk, 'utf8');
    }
    if (!pkgJson) return { ok: false, why: 'package not installed: ' + pkg };
    const parsed = JSON.parse(pkgJson);
    const exp = parsed.exports;
    if (!sub) return { ok: true };
    if (!exp) return { ok: true, why: 'no exports map (legacy main)' };
    if (Object.prototype.hasOwnProperty.call(exp, './' + sub)) return { ok: true };
    const wildcard = Object.keys(exp).some((k) => k.endsWith('/*') && sub.startsWith(k.slice(2, -1)));
    if (wildcard) return { ok: true };
    return { ok: false, why: 'subpath "./' + sub + '" not in exports of ' + pkg };
  };
}

function flattenRows(rows, out = [], depth = 0) {
  for (const row of rows) {
    out.push({ row, depth });
    if (Array.isArray(row.config)) flattenRows(row.config, out, depth + 1);
  }
  return out;
}

function validate(rows, resolves) {
  const bad = [];
  for (const { row } of flattenRows(rows)) {
    const r = resolves(row.name);
    if (!r.ok) bad.push({ id: row.id, name: row.name, why: r.why });
  }
  return bad;
}

// -------------------------------------------------- host roster -> preset rows
function convertConditionals(text) {
  // The host roster uses `!!js` expressions for platform switches. We resolve
  // them for the host we are generating against (Windows desktop).
  if (!text.includes('!!js')) return text;
  return text
    .replace(/!!js\s+process\.platform\s*===\s*'win32'/g, 'true')
    .replace(/!!js\s+process\.platform\s*!==\s*'win32'/g, 'false')
    .replace(/!!js\s+"!ctx\.get\('profileContext'\)"/g, 'true');
}

function loadHostRoster(asar, yaml) {
  const src = asar.read('/dsh/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml');
  if (!src) throw new Error('standard.patch.yml not found in asar: ' + asarPath);
  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === 'plugins:');
  if (start < 0) throw new Error('"plugins:" marker not found in standard.patch.yml');
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') { body.push(''); continue; }
    if (!line.startsWith('          ')) break;
    body.push(line.slice(10));
  }
  let text = convertConditionals(body.join('\n').replace(/\s+$/gm, ''));
  if (text.includes('!!js')) throw new Error('unhandled !!js tag remains in roster');
  const rows = yaml.load(text);
  if (!Array.isArray(rows) || rows.length < 10) throw new Error('roster parse looks wrong');
  return { src, rows };
}

// ---------------------------------------------------------------------- main
const require = createRequire('C:/Users/qiling/.dsh/profiles/desktop/package.json');
const yaml = require('js-yaml');

const asar = openAsar(asarPath);
const resolves = makeResolver(asar, 'C:/Users/qiling/.dsh/profiles/desktop/node_modules');
let rows;
let hostVersion = '';
try {
  if (checkOnly) {
    const mod = await import('file:///' + outPath + '?t=' + Date.now());
    rows = mod.ROWS;
  } else {
    const hostInfo = asar.read('/dsh/node_modules/@deepseek-ai/dsh-web-app/package.json');
    if (hostInfo) hostVersion = JSON.parse(hostInfo).version || '';
    const loaded = loadHostRoster(asar, yaml);
    rows = loaded.rows;
    rows.push({ id: 'armor-gen4', name: 'po-gen', config: { mode: 'armor', via: 'preset' } });
  }

  const bad = validate(rows, resolves);
  if (bad.length) {
    console.error('UNRESOLVABLE preset rows (' + bad.length + '):');
    for (const b of bad) console.error(' - ' + b.id + ' | ' + b.name + ' | ' + b.why);
    process.exitCode = 1;
  } else if (checkOnly) {
    console.log('OK rows=' + flattenRows(rows).length + ' (top-level ' + rows.length + ')');
  } else {
    const banner = [
      '// Generated file — do not edit by hand.',
      '// Source: installed host app.asar → @deepseek-ai/dsh-web-app/presets/standard.patch.yml' + (hostVersion ? ' (v' + hostVersion + ')' : ''),
      '// Regenerate: node tools/build-preset-rows.mjs',
      '// Validated: every row specifier resolves against that host\'s package exports.',
      '',
    ].join('\n');
    const out = banner + 'export const ROWS = ' + JSON.stringify(rows, null, 2) + ';\n';
    fs.writeFileSync(outPath, out);
    console.log('wrote ' + outPath + ' rows=' + flattenRows(rows).length + ' (top-level ' + rows.length + ') bytes=' + Buffer.byteLength(out));
  }
} finally {
  asar.close();
}
