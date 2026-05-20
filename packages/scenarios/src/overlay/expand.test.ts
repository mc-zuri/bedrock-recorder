import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartesian, expandDim, expandOverlay } from './expand.js';
import { parseOverlay } from './schema.js';

test('expandDim: range is inclusive of from and to', () => {
  const out = expandDim({ kind: 'range', from: 0, to: 360, step: 45 });
  assert.deepEqual(out, [0, 45, 90, 135, 180, 225, 270, 315, 360]);
});

test('expandDim: list passes through', () => {
  const out = expandDim({ kind: 'list', values: [-30, 0, 15, 45] });
  assert.deepEqual(out, [-30, 0, 15, 45]);
});

test('expandDim: const yields a single-element array', () => {
  const out = expandDim({ kind: 'const', value: 'water' });
  assert.deepEqual(out, ['water']);
});

test('cartesian: yaw × pitch = N × M cases', () => {
  const cases = cartesian({
    yaw: { kind: 'range', from: 0, to: 270, step: 90 },
    pitch: { kind: 'list', values: [0, 15] },
  });
  // 4 yaws × 2 pitches = 8
  assert.equal(cases.length, 8);
  assert.deepEqual(cases[0]?.args, { yaw: 0, pitch: 0 });
  assert.deepEqual(cases[1]?.args, { yaw: 0, pitch: 15 });
});

test('expandOverlay: produces test-case brackets for every matrix combo', () => {
  const overlay = parseOverlay({
    name: 'walk_yaw_pitch_sweep',
    primitive: 'walk',
    matrix: {
      yaw: { kind: 'range', from: 0, to: 90, step: 45 },
      pitch: { kind: 'list', values: [0, 30] },
    },
  });
  const seq = expandOverlay(overlay);
  // 3 yaws (0,45,90) × 2 pitches (0,30) = 6 cases.
  // Each case = testCaseStart + body + testCaseEnd (at minimum 3 actions if body is one).
  const starts = seq.actions.filter((a) => a.type === 'testCaseStart');
  const ends = seq.actions.filter((a) => a.type === 'testCaseEnd');
  assert.equal(starts.length, 6);
  assert.equal(ends.length, 6);
});

test('expandOverlay: skip table removes specific matrix entries', () => {
  const overlay = parseOverlay({
    name: 's',
    primitive: 'walk',
    matrix: {
      yaw: { kind: 'list', values: [0, 90] },
      pitch: { kind: 'list', values: [0, 30] },
    },
    skip: [{ yaw: 0, pitch: 0 }],
  });
  const seq = expandOverlay(overlay);
  const starts = seq.actions.filter((a) => a.type === 'testCaseStart');
  assert.equal(starts.length, 3, '4 combos - 1 skipped = 3');
});

test('expandOverlay: unknown primitive errors with the list of valid ones', () => {
  const overlay = parseOverlay({
    name: 'bad',
    primitive: 'nope',
    matrix: {},
  });
  assert.throws(() => expandOverlay(overlay), /Unknown primitive 'nope'/);
});
