import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationBuilder } from './builder.js';

test('builder records actions in order', () => {
  const seq = new SimulationBuilder()
    .keyDown('w')
    .waitFor('player_auth_input', 10)
    .keyUp('w')
    .build();

  assert.equal(seq.actions.length, 3);
  assert.equal(seq.actions[0]?.type, 'keyDown');
  assert.equal(seq.actions[1]?.type, 'wait');
  assert.equal(seq.actions[2]?.type, 'keyUp');
});

test('testCase wraps inner actions with start/end markers', () => {
  const seq = new SimulationBuilder()
    .testCase('walk_north', (b) => b.keyDown('w').waitFor('player_auth_input', 5).keyUp('w'))
    .build();

  assert.equal(seq.actions.length, 5);
  assert.equal(seq.actions[0]?.type, 'testCaseStart');
  assert.equal((seq.actions[0] as { name: string }).name, 'walk_north');
  assert.equal(seq.actions[4]?.type, 'testCaseEnd');
});

test('testCase names are not prefixed with a hardcoded version', () => {
  const seq = new SimulationBuilder().testCase('foo', (b) => b.sleep(1)).build();
  const start = seq.actions[0] as { name: string };
  assert.equal(start.name, 'foo', 'v2 used to stamp "1.21.0_foo" — that\'s gone');
});
