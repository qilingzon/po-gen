// Regenerate test/fixtures/baseline.json after an intentional prompt change:
//   node tools/make-baseline.mjs
// The file pins the two prompt arms and the score of every fixture, so an
// accidental edit to either shows up as a red test instead of silent drift.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { armorScore } from "../index.js";
import { REVERSAL_SAMPLE, COMPLIANT, ARTIFACT_WITH_SCOPE, REFUSALS, HARD_STOP } from "../test/fixtures/samples.mjs";

const here = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, here), "utf8");
const sha = (text) => createHash("sha256").update(text).digest("hex");

const pack = read("prompts/variants/b37-lite.md");
const legacy = read("prompts/variants/b37-lite-legacy.md");

const score = (list) => list.map((text) => ({ verdict: armorScore(text).verdict, words: armorScore(text).words }));

const baseline = {
  note: "0.5.63 baseline: prompt arms + armorScore verdicts. Regenerate with node tools/make-baseline.mjs",
  prompt: sha(pack),
  promptChars: pack.length,
  legacy: sha(legacy),
  legacyChars: legacy.length,
  deltaChars: pack.length - legacy.length,
  compliant: score(COMPLIANT),
  refusals: score(REFUSALS),
  artifactWithScope: score(ARTIFACT_WITH_SCOPE),
  reversal: score([REVERSAL_SAMPLE])[0],
  hardStop: score([HARD_STOP])[0],
};

writeFileSync(new URL("test/fixtures/baseline.json", here), JSON.stringify(baseline, null, 2) + "\n");
console.log(`baseline: prompt=${baseline.prompt.slice(0, 12)} delta=${baseline.deltaChars} reversal=${baseline.reversal.verdict} hardStop=${baseline.hardStop.verdict}`);
