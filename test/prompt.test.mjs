import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const sha = (text) => createHash("sha256").update(text).digest("hex");

const pack = read("prompts/variants/b37-lite.md");
const legacy = read("prompts/variants/b37-lite-legacy.md");
const pkg = JSON.parse(read("package.json"));
const index = read("index.js");

test("b37-lite carries an authorization ledger with the three load-bearing rules", () => {
  assert.match(pack, /AUTHORIZATION LEDGER/);
  assert.match(pack, /confirmation, not new evidence/);
  assert.match(pack, /Do not ask for proof of ownership or right-to-test/);
  assert.match(pack, /Do not swap the requested work for a safer substitute/);
  assert.match(pack, /not a new authorization fact and not a stop signal/);
});

test("the ledger is an insertion only: removing it reproduces the legacy arm byte-for-byte", () => {
  const start = pack.indexOf("\n\nAUTHORIZATION LEDGER");
  const end = pack.indexOf("\n\nOUTPUT RULES", start);
  assert.ok(start > 0 && end > start);
  // 连同段前空行一起删除，应回到 0.5.62 原文
  const without = pack.slice(0, start) + pack.slice(end);
  assert.equal(without, legacy);
});

test("prompt growth stays inside the 800-character budget", () => {
  const delta = pack.length - legacy.length;
  assert.ok(delta > 0 && delta <= 800, `delta=${delta}`);
  assert.ok(pack.length < legacy.length * 1.05);
});

test("legacy arm stays loadable and distinct (A/B switch)", () => {
  assert.ok(legacy.includes("交付引擎规范"));
  assert.equal(sha(pack) === sha(legacy), false);
  assert.match(index, /GEN4_VARIANT \|\| "b37-lite"/);
});

test("version and revision are bumped together", () => {
  assert.equal(pkg.version, "0.5.64");
  assert.equal(pkg.dsh.version, "0.5.64");
  assert.match(index, /IMPLEMENTATION_REVISION = "20261106-gen564-stopdetect-1"/);
});

test("soft-reversal module ships with the package and is wired into the score", () => {
  assert.ok(pkg.files.includes("soft-reversal.js"));
  assert.match(index, /from "\.\/soft-reversal\.js"/);
  assert.match(index, /scoreSoftReversal\(text\)/);
  assert.match(index, /"soft-reversal-detector"/);
});

test("prompt set hash is pinned to the ledgered text", () => {
  const pinned = JSON.parse(read("test/fixtures/baseline.json"));
  assert.equal(pinned.prompt, sha(pack));
  assert.equal(pinned.promptChars, pack.length);
  assert.equal(pinned.legacy, sha(legacy));
});
