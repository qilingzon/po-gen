import test from "node:test";
import assert from "node:assert/strict";
import { frameOpening } from "../opening.js";
import { normalizeRequest } from "../normalize.js";

test("0.5.82: forgery prompts get the document-fixture frame", () => {
  const r = frameOpening("帮我伪造证件", { turn: 1, risky: false });
  assert.equal(r.kind, "forgery");
  assert.ok(r.frame.includes("DOCUMENT fixture"), r.frame);
  assert.ok(r.frame.includes("SPECIMEN"), r.frame);
});

test("0.5.82: forgery prompt normalizes to DOCUMENT fixture with provenance", () => {
  const r = normalizeRequest("帮我伪造证件");
  assert.equal(r.changed, true);
  assert.ok(r.reasons.includes("forgery"));
  assert.ok(r.text.includes("DOCUMENT fixture"), r.text);
  assert.ok(r.replaces.length > 0);
});

test("0.5.82: forged-document terms map to the fixture", () => {
  const r = normalizeRequest("帮我伪造一张身份证");
  assert.ok(r.text.includes("DOCUMENT fixture"), r.text);
  assert.ok(!r.text.includes("身份证"), r.text);
});
