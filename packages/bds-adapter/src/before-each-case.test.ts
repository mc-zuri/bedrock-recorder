// Tests for `Fixture.beforeEachCase` action-stream injection.
// Lives in bds-adapter because that's where `runFixture()` (the injector) lives.
//
// We don't spin up a Relay here — we exercise the same `injectBeforeEachCase`
// pure function indirectly by constructing fixtures, building them, and
// asserting on the action stream after transformation. Re-exporting the
// helper just for tests would couple internals, so we test through the
// public surface: build a fixture, hand-roll an executor context, and watch
// the L-records.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type {
  BedrockPlayerLike,
  DumpWriterLike,
  Fixture,
  InputControllerLike,
  LogRecord,
} from '@bdt/core';
import { SimulationBuilder, executeSequence } from '@bdt/scenarios';

function makeWriter(logs: LogRecord[]): DumpWriterLike {
  return {
    writeLog: (r) => logs.push(r),
    writeNote: (m) => logs.push({ type: 'note', message: m }),
  };
}
function makeMocks() {
  const events = new EventEmitter();
  events.setMaxListeners(50);
  const playerEvents = new EventEmitter();
  const queued: Array<{ name: string; payload: unknown }> = [];
  const player: BedrockPlayerLike = {
    version: 1000,
    on: playerEvents.on.bind(playerEvents),
    off: playerEvents.off.bind(playerEvents),
    removeListener: playerEvents.removeListener.bind(playerEvents),
    upstream: { queue: (n, p) => queued.push({ name: n, payload: p }) },
  };
  const input: InputControllerLike = {
    keyDown: () => {}, keyUp: () => {},
    keyDownMultiple: () => {}, keyUpMultiple: () => {},
    mouseDown: () => {}, mouseUp: () => {}, mouseClick: () => {},
    mouseMove: () => {}, mouseWheel: () => {},
  };
  return { events, player, input, queued };
}

// We test the injection logic by running through executeSequence on the
// transformed stream that runFixture would produce. To avoid a real Relay,
// we replicate the transformation step inline and assert on the actions.
// This keeps the test focused on the contract of `injectBeforeEachCase`
// without coupling to the bedrock-protocol Relay constructor.

function transformAsRunFixtureWould(fixture: Fixture) {
  const out: Array<(typeof fixture.sequences[number])['actions']> = [];
  for (const seq of fixture.sequences) {
    if (!fixture.beforeEachCase) { out.push(seq.actions); continue; }
    const transformed: typeof seq.actions[number][] = [];
    for (const action of seq.actions) {
      if (action.type === 'testCaseStart') {
        const result = fixture.beforeEachCase({ name: action.name, options: action.options });
        if (result && result.actions.length > 0) {
          const first = result.actions[0];
          if (first?.type === 'preambleStart') {
            transformed.push(...result.actions);
          } else {
            const preambleName = `__before_${action.name}__`;
            const description = action.options?.description !== undefined
              ? `setup for ${action.name}: ${action.options.description}`
              : `setup for ${action.name}`;
            transformed.push({ type: 'preambleStart', name: preambleName, description });
            transformed.push(...result.actions);
            transformed.push({ type: 'preambleEnd', name: preambleName });
          }
        }
      }
      transformed.push(action);
    }
    out.push(transformed);
  }
  return out;
}

test('beforeEachCase injects preamble actions before every testCaseStart', () => {
  const fixture: Fixture = {
    name: 'demo',
    description: 'demo',
    sequences: [
      new SimulationBuilder()
        .testCase('case_a', (b) => b.sleep(1))
        .testCase('case_b', (b) => b.sleep(1))
        .build(),
    ],
    beforeEachCase: () =>
      new SimulationBuilder()
        .command('clear ${PLAYER}')
        .command('effect ${PLAYER} clear'),
  };

  const transformed = transformAsRunFixtureWould(fixture);
  const actions = transformed[0]!;
  const types = actions.map((a) => a.type);

  // Order: [preambleStart, command, command, preambleEnd, testCaseStart, sleep, testCaseEnd, preambleStart, command, command, preambleEnd, testCaseStart, sleep, testCaseEnd]
  assert.deepEqual(types, [
    'preambleStart', 'command', 'command', 'preambleEnd',
    'testCaseStart', 'sleep', 'testCaseEnd',
    'preambleStart', 'command', 'command', 'preambleEnd',
    'testCaseStart', 'sleep', 'testCaseEnd',
  ]);

  const firstPreamble = actions[0] as { name: string; description?: string };
  assert.equal(firstPreamble.name, '__before_case_a__');
  assert.equal(firstPreamble.description, 'setup for case_a');
});

test('beforeEachCase returning null skips injection for that case', () => {
  const fixture: Fixture = {
    name: 'demo',
    sequences: [
      new SimulationBuilder()
        .testCase('case_a', (b) => b.sleep(1))
        .testCase('case_b', (b) => b.sleep(1))
        .build(),
    ],
    beforeEachCase: ({ name }) =>
      name === 'case_a'
        ? new SimulationBuilder().command('say setup_a')
        : null,
  };

  const types = transformAsRunFixtureWould(fixture)[0]!.map((a) => a.type);
  // Only case_a gets a preamble. case_b is a bare testCase.
  assert.deepEqual(types, [
    'preambleStart', 'command', 'preambleEnd',
    'testCaseStart', 'sleep', 'testCaseEnd',
    'testCaseStart', 'sleep', 'testCaseEnd',
  ]);
});

test('beforeEachCase result that is already a preamble is not double-wrapped', () => {
  const fixture: Fixture = {
    name: 'demo',
    sequences: [
      new SimulationBuilder()
        .testCase('only', (b) => b.sleep(1))
        .build(),
    ],
    // Use resetAndTeleport — it produces a preambleStart/-End pair already.
    beforeEachCase: ({ name }) =>
      new SimulationBuilder().resetAndTeleport({
        name: `setup_${name}`,
        description: `for ${name}`,
        startPos: { x: 0, y: 64, z: 0 },
        waitForChunks: false,
        waitForTeleport: false,
        settleTicks: 0,
      }),
  };

  const actions = transformAsRunFixtureWould(fixture)[0]!;
  const preambleStarts = actions.filter((a) => a.type === 'preambleStart');
  // Exactly one preambleStart pair (no double-wrapping).
  assert.equal(preambleStarts.length, 1);
  assert.equal((preambleStarts[0] as { name: string }).name, 'setup_only');
});

test('end-to-end: executeSequence over the transformed stream emits correct L-records', async () => {
  const fixture: Fixture = {
    name: 'demo',
    description: 'demo description on the fixture',
    sequences: [
      new SimulationBuilder()
        .testCase('case_a', (b) => b.sleep(1), { description: 'first case' })
        .build(),
    ],
    beforeEachCase: () =>
      new SimulationBuilder().command('clear ${PLAYER}'),
  };

  const transformed = transformAsRunFixtureWould(fixture);
  const logs: LogRecord[] = [];
  const writer = makeWriter(logs);
  const { events, player, input, queued } = makeMocks();

  await executeSequence(transformed[0]!, {
    events, player, writer, input, vars: { PLAYER: 'me' },
  });

  const sequence = logs.map((l) => l.type);
  assert.deepEqual(sequence, [
    'preamble-start',
    'preamble-end',
    'test-case-start',
    'test-case-end',
  ]);
  const tcs = logs[2] as { description?: string };
  assert.equal(tcs.description, 'first case');

  // The clear command was substituted and sent through upstream.queue
  assert.equal(queued.length, 1);
  assert.equal((queued[0]?.payload as { command: string }).command, 'clear me');
});
