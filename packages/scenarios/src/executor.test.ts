import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import type {
  ExecutionContext,
  BedrockPlayerLike,
  DumpWriterLike,
  InputControllerLike,
  LogRecord,
} from '@bdt/core';
import { SimulationBuilder } from './builder.js';
import { executeSequence } from './executor.js';

// ─── Mocks ────────────────────────────────────────────────────────────────

interface InputCall {
  method: string;
  args: unknown[];
}

function makeMocks() {
  const events = new EventEmitter();
  events.setMaxListeners(50);

  const playerEvents = new EventEmitter();
  const queued: Array<{ name: string; payload: unknown }> = [];
  const player: BedrockPlayerLike & { __queued: typeof queued } = {
    version: 1000,
    on: playerEvents.on.bind(playerEvents),
    off: playerEvents.off.bind(playerEvents),
    removeListener: playerEvents.removeListener.bind(playerEvents),
    upstream: { queue: (name, payload) => queued.push({ name, payload }) },
    __queued: queued,
  };

  const logs: LogRecord[] = [];
  const writer: DumpWriterLike = {
    writeLog: (rec) => logs.push(rec),
    writeNote: (m) => logs.push({ type: 'note', message: m }),
  };

  const inputCalls: InputCall[] = [];
  const input: InputControllerLike = {
    keyDown: (k) => inputCalls.push({ method: 'keyDown', args: [k] }),
    keyUp: (k) => inputCalls.push({ method: 'keyUp', args: [k] }),
    keyDownMultiple: (ks) => inputCalls.push({ method: 'keyDownMultiple', args: [ks] }),
    keyUpMultiple: (ks) => inputCalls.push({ method: 'keyUpMultiple', args: [ks] }),
    mouseDown: (b) => inputCalls.push({ method: 'mouseDown', args: [b] }),
    mouseUp: (b) => inputCalls.push({ method: 'mouseUp', args: [b] }),
    mouseClick: (b) => inputCalls.push({ method: 'mouseClick', args: [b] }),
    mouseMove: (dx, dy) => inputCalls.push({ method: 'mouseMove', args: [dx, dy] }),
    mouseWheel: (d) => inputCalls.push({ method: 'mouseWheel', args: [d] }),
  };

  return { events, playerEvents, player, writer, input, logs, inputCalls, queued };
}

function makeCtx(overrides: Partial<ExecutionContext> = {}): ExecutionContext & ReturnType<typeof makeMocks> {
  const mocks = makeMocks();
  return Object.assign(mocks, {
    events: mocks.events,
    player: mocks.player,
    writer: mocks.writer,
    input: mocks.input,
    vars: { PLAYER: 'TestPlayer' },
    ...overrides,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

test('executor runs sync actions in order', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder().keyDown('w').keyUp('w').mouseMove(10, 20).build();
  await executeSequence(seq.actions, ctx);
  assert.deepEqual(ctx.inputCalls, [
    { method: 'keyDownMultiple', args: [['w']] },
    { method: 'keyUpMultiple',   args: [['w']] },
    { method: 'mouseMove',       args: [10, 20] },
  ]);
});

test('executor waits for N events before proceeding', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder()
    .keyDown('w')
    .waitFor('player_auth_input', 3)
    .keyUp('w')
    .build();

  const done = executeSequence(seq.actions, ctx);

  // Fire 2 events — should still be waiting.
  await sleep(5);
  ctx.events.emit('player_auth_input');
  ctx.events.emit('player_auth_input');
  await sleep(5);
  // KeyDown happened; keyUp hasn't.
  assert.equal(ctx.inputCalls.length, 1);

  // 3rd event releases the wait.
  ctx.events.emit('player_auth_input');
  await done;
  assert.equal(ctx.inputCalls.length, 2);
  assert.equal(ctx.inputCalls[1]?.method, 'keyUpMultiple');
});

test('executor: command action substitutes ${PLAYER} from ctx.vars', async () => {
  const ctx = makeCtx({ vars: { PLAYER: 'TestUser' } });
  const seq = new SimulationBuilder().command('give ${PLAYER} diamond_sword 2').build();
  await executeSequence(seq.actions, ctx);
  assert.equal(ctx.queued.length, 1);
  const payload = ctx.queued[0]?.payload as { command: string };
  assert.equal(payload.command, 'give TestUser diamond_sword 2');
});

test('executor: command action keeps @a literal (no substitution)', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder().command('op @a').build();
  await executeSequence(seq.actions, ctx);
  const payload = ctx.queued[0]?.payload as { command: string };
  assert.equal(payload.command, 'op @a');
});

test('executor: command_request shape switches on player.version < 944', async () => {
  const ctxOld = makeCtx();
  ctxOld.player.version = 100;
  await executeSequence(new SimulationBuilder().command('say hi').build().actions, ctxOld);
  assert.equal(ctxOld.queued[0]?.name, 'command_request');
  const oldPayload = ctxOld.queued[0]?.payload as { version: unknown };
  assert.equal(oldPayload.version, 78, 'protocol <944 uses numeric version 78');

  const ctxNew = makeCtx();
  ctxNew.player.version = 1000;
  await executeSequence(new SimulationBuilder().command('say hi').build().actions, ctxNew);
  const newPayload = ctxNew.queued[0]?.payload as { version: unknown; origin: { player_entity_id?: unknown } };
  assert.equal(newPayload.version, 'latest');
  assert.equal(newPayload.origin.player_entity_id, 0n, '>= 944 includes player_entity_id BigInt');
});

test('executor: teleport uses ${PLAYER} not a hardcoded username', async () => {
  const ctx = makeCtx({ vars: { PLAYER: 'somebody' } });
  const seq = new SimulationBuilder().teleport(1, 2, 3, 90, 0).build();
  await executeSequence(seq.actions, ctx);
  const payload = ctx.queued[0]?.payload as { command: string };
  assert.equal(payload.command, 'teleport somebody 1 2 3 90 0');
});

test('executor: testCase actions write L-records and fire hooks', async () => {
  const startNames: string[] = [];
  const endNames: string[] = [];
  const ctx = makeCtx({
    hooks: {
      onTestCaseStart: (n) => startNames.push(n),
      onTestCaseEnd: (n) => endNames.push(n),
    },
  });
  const seq = new SimulationBuilder()
    .testCase('case_a', (b) => b.sleep(1))
    .testCase('case_b', (b) => b.sleep(1))
    .build();
  await executeSequence(seq.actions, ctx);
  assert.deepEqual(startNames, ['case_a', 'case_b']);
  assert.deepEqual(endNames, ['case_a', 'case_b']);
  // logs: 2x test-case-start + 2x test-case-end
  const types = ctx.logs.map((l) => l.type);
  assert.deepEqual(types, ['test-case-start', 'test-case-end', 'test-case-start', 'test-case-end']);
});

test('executor: signal aborts mid-sequence', async () => {
  const ctx = makeCtx({ signal: AbortSignal.timeout(10) });
  const seq = new SimulationBuilder()
    .keyDown('w')
    .waitFor('player_auth_input', 100)   // will never fire 100 times
    .keyUp('w')
    .build();

  await assert.rejects(
    executeSequence(seq.actions, ctx),
    (err: Error) => err.message.includes('Sequence aborted'),
  );
});

test('executor: error in a predicate wraps with action index/type', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder()
    .keyDown('w')
    .waitUntil(() => {
      throw new Error('boom');
    })
    .build();

  const done = executeSequence(seq.actions, ctx);
  // Trigger the predicate by emitting a serverbound event.
  await sleep(5);
  ctx.playerEvents.emit('serverbound', { name: 'pai', params: {} });
  await assert.rejects(done, /Action #1 \(waitUntil\) failed: boom/);
});

test('executor: mouseClick splits down/up across a PAI tick', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder().mouseClick('left').build();
  const done = executeSequence(seq.actions, ctx);

  await sleep(5);
  // Down has fired, up hasn't yet (waiting for PAI).
  assert.equal(ctx.inputCalls.filter((c) => c.method === 'mouseDown').length, 1);
  assert.equal(ctx.inputCalls.filter((c) => c.method === 'mouseUp').length, 0);

  ctx.events.emit('player_auth_input');
  await done;
  assert.equal(ctx.inputCalls.filter((c) => c.method === 'mouseUp').length, 1);
});

test('executor: waitUntilChunksLoaded resolves after silence', async () => {
  const ctx = makeCtx();
  const seq = new SimulationBuilder().waitUntilChunksLoaded().build();

  const done = executeSequence(seq.actions, ctx);

  // Spam subchunks for a bit, then go silent.
  for (let i = 0; i < 5; i++) {
    await sleep(10);
    ctx.playerEvents.emit('clientbound', { name: 'subchunk' });
  }
  // No more subchunks — should resolve ~500ms after the last one.
  await done;
});
