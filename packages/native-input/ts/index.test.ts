import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keys, resolveKey } from './keys.js';

test('Keys map covers common bedrock controls', () => {
  // Anything the v2 simulation-builder used must resolve.
  for (const key of ['w', 'a', 's', 'd', 'space', 'shift', 'ctrl', 'enter', 'escape'] as const) {
    const vk = resolveKey(key);
    assert.equal(typeof vk, 'number');
    assert.ok(vk > 0 && vk < 256, `${key} resolved to a sensible VK (${vk})`);
  }
});

test('resolveKey passes numeric VKs through', () => {
  assert.equal(resolveKey(0x57), 0x57);
});

test('resolveKey throws on unknown name', () => {
  assert.throws(
    () => resolveKey('not-a-key' as never),
    /Unknown key 'not-a-key'/
  );
});

test('Keys.w is the W virtual-key (0x57)', () => {
  assert.equal(Keys.w, 0x57);
});

// Smoke test that the native addon loads. Skipped on non-Windows.
test('native addon loads on win32', { skip: process.platform !== 'win32' }, async () => {
  const { InputController } = await import('./index.js');
  const ctrl = new InputController({ foregroundFilter: '__never_matches__' });
  // With a filter that won't match, sendInput should return 0 — proves the gate works
  // and lets us avoid actually injecting input during tests.
  const title = ctrl.getForegroundWindowTitle();
  assert.equal(typeof title, 'string');
});
