import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type {
  ExecutionContext,
  BedrockPlayerLike,
  DumpWriterLike,
  InputControllerLike,
  LogRecord,
} from '@bdt/core';
import { SimulationBuilder } from './builder.js';
import { executeSequence } from './executor.js';

function makeCtx(): ExecutionContext & {
  logs: LogRecord[];
  queued: Array<{ name: string; payload: unknown }>;
} {
  const events = new EventEmitter();
  events.setMaxListeners(50);
  const playerEvents = new EventEmitter();
  const queued: Array<{ name: string; payload: unknown }> = [];
  const player: BedrockPlayerLike = {
    version: 1000,
    on: playerEvents.on.bind(playerEvents),
    off: playerEvents.off.bind(playerEvents),
    removeListener: playerEvents.removeListener.bind(playerEvents),
    upstream: { queue: (name, payload) => queued.push({ name, payload }) },
  };
  const logs: LogRecord[] = [];
  const writer: DumpWriterLike = {
    writeLog: (rec) => logs.push(rec),
    writeNote: (m) => logs.push({ type: 'note', message: m }),
  };
  const input: InputControllerLike = {
    keyDown: () => {}, keyUp: () => {},
    keyDownMultiple: () => {}, keyUpMultiple: () => {},
    mouseDown: () => {}, mouseUp: () => {}, mouseClick: () => {},
    mouseMove: () => {}, mouseWheel: () => {},
  };
  return { events, player, writer, input, vars: { PLAYER: 'tester' }, logs, queued };
}

test('testCase passes description into the L-record', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder()
    .testCase('walk_n', (b) => b.sleep(1), { description: 'walk north 20 ticks' })
    .build();
  await executeSequence(seq.actions, ctx);

  const start = ctx.logs.find((l) => l.type === 'test-case-start') as
    | { type: string; name: string; description?: string }
    | undefined;
  assert.ok(start);
  assert.equal(start.name, 'walk_n');
  assert.equal(start.description, 'walk north 20 ticks');
});

test('preamble emits preamble-start / preamble-end L-records around inner actions', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder()
    .preamble('reset', (b) => b.command('clear ${PLAYER}'), { description: 'wipe inventory' })
    .testCase('main', (b) => b.sleep(1))
    .build();
  await executeSequence(seq.actions, ctx);

  const types = ctx.logs.map((l) => l.type);
  assert.deepEqual(types, [
    'preamble-start',
    'preamble-end',
    'test-case-start',
    'test-case-end',
  ]);
  const start = ctx.logs[0] as { name: string; description?: string };
  assert.equal(start.name, 'reset');
  assert.equal(start.description, 'wipe inventory');

  // command was substituted and sent
  assert.equal(ctx.queued.length, 1);
  assert.equal((ctx.queued[0]?.payload as { command: string }).command, 'clear tester');
});

test('resetAndTeleport composes the canonical setup sequence', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder()
    .resetAndTeleport({
      startPos: { x: 10, y: 64, z: -5 },
      yaw: 90,
      pitch: 0,
      waitForChunks: false,      // skip the chunk-load wait so the test doesn't hang
      waitForTeleport: false,    // skip the teleport handshake wait too
      settleTicks: 0,
    })
    .build();

  await executeSequence(seq.actions, ctx);

  // 3 commands queued: effect clear, effect resistance, clear; + 1 teleport command
  const commands = ctx.queued.map((q) => (q.payload as { command: string }).command);
  assert.deepEqual(commands, [
    'effect tester clear',
    'effect tester resistance 9999 255 true',
    'clear tester',
    'teleport tester 10 64 -5 90 0',
  ]);

  // preamble brackets surround the whole sequence
  assert.equal(ctx.logs[0]?.type, 'preamble-start');
  assert.equal(ctx.logs[ctx.logs.length - 1]?.type, 'preamble-end');
});

test('resetAndTeleport respects opt-outs for each step', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder()
    .resetAndTeleport({
      startPos: { x: 0, y: 0, z: 0 },
      clearEffects: false,
      giveResistance: false,
      clearInventory: false,
      waitForChunks: false,
      waitForTeleport: false,
      settleTicks: 0,
    })
    .build();
  await executeSequence(seq.actions, ctx);

  const commands = ctx.queued.map((q) => (q.payload as { command: string }).command);
  // Only the teleport runs when everything else is disabled.
  assert.deepEqual(commands, ['teleport tester 0 0 0 0 0']);
});

test('sceneTestCase: preamble clears state, testCase emits SETUP/START notes and final teleport', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder()
    .sceneTestCase({
      name: 'walk_speed1',
      description: 'Walk forward 5t with Speed I',
      setupDescription: 'apply speed 1',
      startPos: { x: 10, y: 0, z: 0 },
      yaw: 0,
      setup: (b) => b.command('effect ${PLAYER} speed 30 0 true'),
      run: (b) => b.command('say hi'),
      waitForChunks: false,
      preambleSettleTicks: 0,
      setupSettleTicks: 0,
      preActionTicks: 0,
      postActionTicks: 0,
    })
    .build();
  await executeSequence(seq.actions, ctx);

  // Three L bracket levels: reset preamble, setup preamble (with SETUP +
  // START note markers + final teleport), then the test case window
  // around just the run() body. Setup commands and the final teleport
  // moved OUT of the test case window so the recorded fixture starts at
  // the first real input — see sceneTestCase docstring.
  const types = ctx.logs.map((l) => l.type);
  assert.deepEqual(types, [
    'preamble-start',  // {name}_reset
    'preamble-end',
    'preamble-start',  // {name}_setup
    'note',            // SETUP: marker
    'note',            // START: marker
    'preamble-end',
    'test-case-start',
    'test-case-end',
  ]);

  const setupNote = ctx.logs[3] as { message: string };
  const startNote = ctx.logs[4] as { message: string };
  assert.equal(setupNote.message, 'SETUP: apply speed 1');
  assert.equal(startNote.message, 'START: Walk forward 5t with Speed I');

  // Command stream: reset cleanups + safe-zone teleport (preamble 1),
  // then setup command + final teleport-to-startPos (preamble 2), then
  // the run command. Safe-zone Y is anchor.y, NOT max(anchor, startPos)
  // — so player stands on the platform during reset, then teleports up
  // (or wherever) for the actual test.
  const commands = ctx.queued.map((q) => (q.payload as { command: string }).command);
  assert.deepEqual(commands, [
    'clear tester',
    'effect tester clear',
    'effect tester resistance 9999 255 true',
    'teleport tester 10 0 0 0 0',             // safe zone @ anchor.y=0
    'effect tester speed 30 0 true',          // setup preamble
    'teleport tester 10 0 0 0 0',             // final teleport to startPos
    'say hi',                                  // run actions (in test-case window)
  ]);
});

test('sceneTestCase: sceneAnchor moves safe-zone to per-scene anchor (not above startPos)', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder()
    .sceneTestCase({
      name: 'water_walk',
      startPos: { x: 0, y: -5, z: 100 },    // submerged inside water pool
      sceneAnchor: { x: 0, y: 0, z: 89 },   // waterPool's view position
      run: (b) => b.command('say x'),
      waitForChunks: false,
      preambleSettleTicks: 0,
      setupSettleTicks: 0,
      preActionTicks: 0,
      postActionTicks: 0,
    })
    .build();
  await executeSequence(seq.actions, ctx);

  const commands = ctx.queued.map((q) => (q.payload as { command: string }).command);
  // Safe-zone uses anchor's x/z, with y = max(anchor.y, startPos.y) + 0 = 0.
  assert.ok(commands.includes('teleport tester 0 0 89 0 0'),
    'safe-zone teleport should land at the scene anchor column, not above startPos');
  // Then the final teleport to the actual test position.
  assert.ok(commands.includes('teleport tester 0 -5 100 0 0'),
    'final teleport should go to startPos');
});

test('preamble hooks fire on start and end', async () => {
  const ctx = makeCtx();
  const starts: Array<{ name: string; description?: string }> = [];
  const ends: string[] = [];
  ctx.hooks = {
    onPreambleStart: (name, description) => starts.push({ name, description }),
    onPreambleEnd: (name) => ends.push(name),
  };
  const seq = new SimulationBuilder()
    .preamble('reset', (b) => b.sleep(1), { description: 'd1' })
    .preamble('reset2', (b) => b.sleep(1))
    .build();
  await executeSequence(seq.actions, ctx);
  assert.deepEqual(starts, [
    { name: 'reset', description: 'd1' },
    { name: 'reset2', description: undefined },
  ]);
  assert.deepEqual(ends, ['reset', 'reset2']);
});
