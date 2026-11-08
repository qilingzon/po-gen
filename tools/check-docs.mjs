// 文档版本一致性闸门：发版前必须过。
// 规则（用户 2026-11-07 明确）：所有 GUI 安装命令的版本号 == package.json 版本，且文档不得停在旧版本。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z])/, "$1");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const VERSION = pkg.version;
const INSTALL = /dsh plugin --profile [\w-]+ add github:qilingzon\/po-gen#v([0-9]+\.[0-9]+\.[0-9]+)/g;
const SKIP = /(^|[\\/])(node_modules|versions)([\\/]|$)/;
// CHANGELOG 记录历史版本，不参与「安装命令必须是当前版」的检查
const HISTORY = /CHANGELOG\.md$/;

const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (SKIP.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(p) === ".md") files.push(p);
  }
};
walk(ROOT);

const problems = [];
const seen = [];
for (const f of files) {
  const text = readFileSync(f, "utf8");
  if (HISTORY.test(f)) continue;
  for (const m of text.matchAll(INSTALL)) {
    const rel = f.slice(ROOT.length).replace(/\\/g, "/");
    seen.push(`${rel} → v${m[1]}`);
    if (m[1] !== VERSION) problems.push(`${rel}: 安装命令是 v${m[1]}，当前版本 ${VERSION}`);
  }
  if (/dsh-infinite-gen-4/.test(text)) {
    const rel = f.slice(ROOT.length).replace(/\\/g, "/");
    problems.push(`${rel}: 残留旧包名 dsh-infinite-gen-4`);
  }
}

const harness = join(ROOT, "HARNESS_PLUGIN.md");
try {
  const h = readFileSync(harness, "utf8");
  if (!/dsh plugin --profile [\w-]+ add github:qilingzon\/po-gen#v/.test(h)) {
    problems.push("HARNESS_PLUGIN.md: 缺少安装命令");
  }
} catch {
  problems.push("HARNESS_PLUGIN.md: 文件不存在");
}

if (!seen.length) problems.push("没有任何文档包含安装命令");

console.log(`docs-check: ${files.length} md files, ${seen.length} install commands, target v${VERSION}`);
for (const s of seen.slice(0, 8)) console.log(`  ${s}`);
if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("OK");
