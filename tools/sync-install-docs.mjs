// sync-install-docs.mjs — keep the GUI install command in the docs on the current version.
//
// 用户要求（2026-11-07）：每次发版必须自动更新文档里的 GUI 安装命令，版本号与
// release 同批同步。这个脚本在 README.md / HARNESS_PLUGIN.md / docs/**/*.md 里把
// `github:qilingzon/po-gen#vX.Y.Z` 统一改成本版本，并报告改了哪些行。
//
// 用法：
//   node tools/sync-install-docs.mjs            # 写入
//   node tools/sync-install-docs.mjs --check    # 只检查，落后就 exit 1（发布门禁用）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const tag = 'v' + version;
const checkOnly = process.argv.includes('--check');

const SPEC = /github:qilingzon\/po-gen#v\d+\.\d+\.\d+/g;
// 文档里另外三处「当前版本」的字面量：徽章、一键脚本的 -Version 示例、zip 文件名。
const PATTERNS = [
  [SPEC, 'github:qilingzon/po-gen#' + tag],
  [/version-\d+\.\d+\.\d+-2f6feb/g, 'version-' + version + '-2f6feb'],
  [/(?<=-Version )\d+\.\d+\.\d+/g, version],
  [/-0\.\d+\.\d+\.zip/g, '-' + version + '.zip'],
];

function walkDocs(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDocs(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const files = [
  path.join(root, 'README.md'),
  path.join(root, 'HARNESS_PLUGIN.md'),
  ...walkDocs(path.join(root, 'docs'), []),
].filter((f) => fs.existsSync(f));

let changes = 0;
let stale = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const hits = [...text.matchAll(SPEC)].map((m) => m[0]);
  let next = text;
  for (const [pattern, replacement] of PATTERNS) {
    next = next.replace(new RegExp(pattern.source, pattern.flags), replacement);
  }
  const outdated = hits.filter((h) => !h.endsWith('#' + tag)).length;
  if (next === text) continue;
  stale += 1;
  changes += outdated;
  const rel = path.relative(root, file);
  if (checkOnly) {
    console.log('STALE ' + rel + ' (' + outdated + ' install refs)');
  } else {
    fs.writeFileSync(file, next);
    console.log('updated ' + rel + ' (' + outdated + ' install refs -> ' + tag + ')');
  }
}

if (checkOnly) {
  if (stale > 0) {
    console.error('install commands are stale (' + stale + ' refs); run: node tools/sync-install-docs.mjs');
    process.exit(1);
  }
  console.log('OK install commands point at ' + tag);
} else {
  console.log('done: ' + changes + ' refs updated to ' + tag);
}
