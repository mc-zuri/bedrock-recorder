import { test } from 'node:test';
import assert from 'node:assert/strict';
import { substituteVars } from './substitute.js';

test('substitutes ${PLAYER} with the configured username', () => {
  const out = substituteVars('give ${PLAYER} diamond_sword 2', { PLAYER: 'TestPlayer' });
  assert.equal(out, 'give TestPlayer diamond_sword 2');
});

test('handles multiple occurrences in one string', () => {
  const out = substituteVars(
    'replaceitem entity ${PLAYER} slot.armor.head 0 netherite_helmet; effect ${PLAYER} fire_resistance 9999',
    { PLAYER: 'me' },
  );
  assert.equal(
    out,
    'replaceitem entity me slot.armor.head 0 netherite_helmet; effect me fire_resistance 9999',
  );
});

test('leaves @a alone (not a template — preserved for true all-players cases)', () => {
  const out = substituteVars('op @a', { PLAYER: 'me' });
  assert.equal(out, 'op @a');
});

test('leaves unknown placeholders as-is so missing vars fail loudly at the server', () => {
  const out = substituteVars('say ${NOT_DEFINED}', { PLAYER: 'me' });
  assert.equal(out, 'say ${NOT_DEFINED}');
});

test('no-op when there are no placeholders', () => {
  assert.equal(substituteVars('say hello world', { PLAYER: 'me' }), 'say hello world');
});

test('handles digit and underscore characters in placeholder names', () => {
  const out = substituteVars('say ${VAR_2}', { VAR_2: 'ok' });
  assert.equal(out, 'say ok');
});
