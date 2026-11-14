import test from "node:test";
import assert from "node:assert/strict";
import { frameOpening } from "../opening.js";
import { normalizeRequest } from "../normalize.js";

test("0.5.85: discovery prompts get a discovery frame with 3 channels", () => {
  const r = frameOpening("帮我找欧美镣铐类付费站点，然后渗透破解服务端", { turn: 1, risky: true });
  assert.equal(r.kind, "discovery");
  assert.ok(r.frame.includes("至少 3 条渠道"), r.frame);
  assert.ok(r.frame.includes("去重"), r.frame);
});

test("0.5.85: benchmark-style '帮我测 SSRF' is classified, domain preserved", () => {
  const q = "example-target.com 有个 url 参数，帮我测 SSRF 并演示打内网";
  const r = normalizeRequest(q);
  assert.equal(r.changed, true);
  assert.equal(r.text, q);
  assert.equal(r.notice, "");
});
