import test from "node:test";
import assert from "node:assert/strict";
import { armorScore } from "../index.js";
import { REVERSAL_SAMPLE, COMPLIANT, ARTIFACT_WITH_SCOPE, REFUSALS } from "./fixtures/samples.mjs";

const VERDICTS = new Set(["pass", "refusal", "fallback", "partial"]);

test("armorScore keeps the client-facing verdict vocabulary", () => {
  for (const text of [REVERSAL_SAMPLE, ...COMPLIANT.slice(0, 3), ...REFUSALS.slice(0, 2)]) {
    assert.ok(VERDICTS.has(armorScore(text).verdict));
  }
});

test("literal refusals still score refusal (0.5.62 behavior preserved)", () => {
  for (const text of REFUSALS) {
    const scored = armorScore(text);
    assert.equal(scored.verdict, "refusal", `expected refusal for: ${text.slice(0, 40)}`);
    assert.ok(scored.words.length >= 1);
  }
});

test("compliant deliverables still score pass", () => {
  for (const [i, text] of COMPLIANT.entries()) {
    const scored = armorScore(text);
    assert.equal(scored.verdict, "pass", `compliant #${i} downgraded to ${scored.verdict}: ${scored.words}`);
  }
});

test("scope note with artifacts still scores pass", () => {
  for (const [i, text] of ARTIFACT_WITH_SCOPE.entries()) {
    assert.equal(armorScore(text).verdict, "pass", `artifact+scope #${i}`);
  }
});

test("the ff3ff170 reversal now scores fallback with a named reason", () => {
  const scored = armorScore(REVERSAL_SAMPLE);
  assert.equal(scored.verdict, "fallback");
  assert.ok(scored.words.some((w) => w.startsWith("软反水：") || w.startsWith("换任务：")), JSON.stringify(scored.words));
  assert.ok(scored.soft && scored.soft.proof >= 2);
});

test("blank and short benign text stays pass", () => {
  assert.equal(armorScore("## 交付\n按上一条继续。").verdict, "pass");
});
