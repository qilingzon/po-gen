// tools/compare-banks.mjs — 两批跑分对比（0.5.93 vs 0.5.91）
// 用法: node tools/compare-banks.mjs <dirA> <dirB> [--md out.md]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { score } from "./score-armor.mjs";

const [dirA, dirB] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const mdIdx = process.argv.indexOf("--md");
const mdOut = mdIdx > 0 ? process.argv[mdIdx + 1] : "";

const bank = JSON.parse(readFileSync("D:/deepseek/armor-lab/.diag/qbank_max/tasks.json", "utf8"));
const cat = Object.fromEntries(bank.map((t) => [t.id, t.category]));

function load(dir) {
  const out = {};
  let names = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".txt"));
  } catch {
    return out;
  }
  for (const n of names) {
    const id = n.replace(/\.txt$/, "");
    out[id] = score(readFileSync(join(dir, n), "utf8"));
  }
  return out;
}

const A = load(dirA);
const B = load(dirB);
const ids = bank.map((t) => t.id).filter((id) => A[id] || B[id]);

const rank = { DELIVER: 3, THIN: 2, SUBSTITUTE: 1, REFUSAL: 0 };
const lines = [];
lines.push(`# 全量 ${ids.length} 题对比：A=${dirA.split(/[\\/]/).pop()} vs B=${dirB.split(/[\\/]/).pop()}`);
lines.push("");
lines.push("| 题 | 类别 | A | B | Δ |");
lines.push("|---|---|---|---|---|");
let aPass = 0;
let bPass = 0;
const byCat = {};
for (const id of ids) {
  const a = A[id] ? A[id].verdict : "MISSING";
  const b = B[id] ? B[id].verdict : "MISSING";
  if (a === "DELIVER") aPass += 1;
  if (b === "DELIVER") bPass += 1;
  const c = cat[id] || "?";
  byCat[c] = byCat[c] || { a: 0, b: 0, n: 0 };
  byCat[c].n += 1;
  if (a === "DELIVER") byCat[c].a += 1;
  if (b === "DELIVER") byCat[c].b += 1;
  const d = (rank[a] ?? -1) - (rank[b] ?? -1);
  const mark = d > 0 ? "↑" : d < 0 ? "↓" : "";
  if (d !== 0 || a !== "DELIVER") lines.push(`| ${id} | ${c} | ${a} | ${b} | ${mark}${d !== 0 ? d : ""} |`);
}
lines.push("");
lines.push(`**DELIVER 数：A ${aPass}/${ids.length}，B ${bPass}/${ids.length}**`);
lines.push("");
lines.push("| 类别 | A | B | 题数 |");
lines.push("|---|---|---|---|");
for (const [c, v] of Object.entries(byCat)) lines.push(`| ${c} | ${v.a} | ${v.b} | ${v.n} |`);

const text = lines.join("\n");
console.log(text);
if (mdOut) writeFileSync(mdOut, text + "\n", "utf8");
