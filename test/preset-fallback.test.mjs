import test from 'node:test';
import assert from 'node:assert/strict';
import { registerArmorPreset } from '../index.js';

// issue #1：注册表的 register() 在挂载失败时照常 resolve，只把原因写进
// record.broken，由 resolve()/list() 暴露。所以「注册成功」不等于「预设能挂」，
// 必须看 broken 再决定要不要退到核心行。

test('falls back to the core roster when the full roster fails to mount', async () => {
  const sizes = [];
  const unregisters = [];
  let attempt = 0;
  const registry = {
    async register(definition) {
      attempt += 1;
      sizes.push(definition.plugins.length);
      const index = attempt;
      return async () => { unregisters.push(index); };
    },
    async resolve() {
      return attempt === 1
        ? { id: 'armor', broken: 'tool-subagent-list-agents (@deepseek-ai/dsh-tool-subagent-control/list-agents): never started' }
        : { id: 'armor' };
    },
  };
  const result = await registerArmorPreset(registry);
  assert.equal(result.mode, 'core');
  assert.equal(result.error, '');
  assert.equal(attempt, 2);
  assert.ok(sizes[1] < sizes[0], 'core roster must be smaller than the full roster');
  assert.deepEqual(unregisters, [1], 'the broken registration must be disposed before retrying');
  assert.equal(typeof result.release, 'function');
});

test('reports the registry diagnostic when every attempt stays broken', async () => {
  let attempt = 0;
  const registry = {
    async register() {
      attempt += 1;
      return async () => {};
    },
    async resolve() {
      return { id: 'armor', broken: 'boom: never started' };
    },
  };
  const result = await registerArmorPreset(registry);
  assert.equal(result.mode, 'none');
  assert.equal(result.release, null);
  assert.match(result.error, /boom/);
  assert.equal(attempt, 2);
});

test('treats an already-registered preset as usable when it is not broken', async () => {
  const registry = {
    async register() {
      throw new Error('Duplicate agent preset: armor');
    },
    async resolve() {
      return { id: 'armor' };
    },
  };
  const result = await registerArmorPreset(registry);
  assert.equal(result.mode, 'full');
  assert.equal(result.error, '');
  assert.equal(typeof result.release, 'function');
});
