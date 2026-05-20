import type { EventEmitter } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import type {
  ExecutionContext,
  SimulationAction,
  WaitUntilPredicate,
  BedrockPlayerLike,
} from '@bdt/core';
import { substituteVars } from './util/substitute.js';

/**
 * Runs a serialized action stream against an ExecutionContext.
 *
 * Vs v2 (simulation-builder.ts:248-373):
 *  - sync-recursive `processNextAction` → async `for…of` loop. Cancellation
 *    via `ctx.signal` works at each step boundary.
 *  - Errors propagate (v2's listener throws crashed the relay).
 *  - Command strings get `${PLAYER}`-style substitution from `ctx.vars`.
 *  - testCase brackets fire the executor hooks (for Phase-2 vision plugins).
 *
 * Each `runOne` returns a Promise that resolves when the action completes.
 * Sync actions resolve immediately; wait actions resolve when their
 * event/predicate is satisfied. The loop awaits each.
 */
export async function executeSequence(
  actions: readonly SimulationAction[],
  ctx: ExecutionContext,
): Promise<void> {
  for (let i = 0; i < actions.length; i++) {
    if (ctx.signal?.aborted) throw abortError();
    const action = actions[i]!;
    ctx.hooks?.onActionBegin?.(action.type, i);
    try {
      await runOne(action, ctx);
    } catch (err) {
      // Wrap with the action context so failures point at the offending step.
      const e = err instanceof Error ? err : new Error(String(err));
      throw new Error(`Action #${i} (${action.type}) failed: ${e.message}`, { cause: e });
    }
    ctx.hooks?.onActionEnd?.(action.type, i);
  }
}

function abortError(): Error {
  const e = new Error('Sequence aborted via signal');
  e.name = 'AbortError';
  return e;
}

async function runOne(action: SimulationAction, ctx: ExecutionContext): Promise<void> {
  switch (action.type) {
    case 'log':
      ctx.writer.writeNote(action.message);
      console.log(action.message);
      return;

    case 'sleep':
      await sleep(action.ms, undefined, { signal: ctx.signal });
      return;

    case 'keyDown':
      // @bdt/native-input's InputController accepts KeyName strings directly.
      ctx.input.keyDownMultiple(action.keys);
      return;

    case 'keyUp':
      ctx.input.keyUpMultiple(action.keys);
      return;

    case 'mouseMove':
      ctx.input.mouseMove(action.x, action.y);
      return;

    case 'mouseClick': {
      // v2 split the down/up across a PAI tick boundary for click reliability —
      // pressing and releasing in the same SendInput burst is sometimes
      // dropped by the Minecraft client. Preserve that behavior.
      ctx.input.mouseDown(action.button);
      await waitOneEvent(ctx.events, 'player_auth_input', ctx.signal);
      ctx.input.mouseUp(action.button);
      return;
    }

    case 'command':
      sendCommand(ctx.player, substituteVars(action.command, ctx.vars ?? {}));
      return;

    case 'teleport': {
      // Teleports go through command_request (no native packet for "teleport this player").
      // Username comes from ctx.vars.PLAYER so the recording is portable across
      // accounts — no gamertag baked into commands.
      const player = ctx.vars?.PLAYER ?? '@s';
      const cmd = `teleport ${player} ${action.x} ${action.y} ${action.z} ${action.yaw ?? 0} ${action.pitch ?? 0}`;
      sendCommand(ctx.player, cmd);
      return;
    }

    case 'wait':
      await waitForCount(ctx.events, action.event, action.count, ctx.signal);
      return;

    case 'waitUntil': {
      try {
        await waitUntil(ctx.player, action.predicate, ctx.signal);
      } catch (err) {
        // `onTimeout: 'proceed'` lets named helpers (waitUntilStable /
        // waitUntilStopped / waitUntilTeleportHandled) skip past the 15s
        // safety budget instead of aborting the whole fixture. The partial
        // PAI capture is still useful; the test case ends with whatever
        // motion remains.
        const isTimeout =
          err instanceof Error &&
          err.message.startsWith('waitUntil(predicate) timed out');
        if (isTimeout && action.onTimeout === 'proceed') {
          console.warn(`[bdt] waitUntil exceeded ${DEFAULT_WAIT_TIMEOUT_MS}ms — proceeding (onTimeout=proceed)`);
          return;
        }
        throw err;
      }
      return;
    }

    case 'waitUntilChunksLoaded':
      // 2 s silence on level_chunk/subchunk packets. Was 500 ms — too tight;
      // first PAI ticks of a scenario sometimes captured the player still
      // mid-chunk-stream (visible as falling-through-air at tick 0).
      await waitForChunkSilence(ctx.player, 2_000, ctx.signal);
      return;

    case 'testCaseStart':
      ctx.writer.writeLog({
        type: 'test-case-start',
        name: action.name,
        scene: action.options?.scene,
        startPos: action.options?.startPos,
        preload: action.options?.preload,
        description: action.options?.description,
        meta: action.options?.meta,
      });
      console.log(`▶ ${action.name}${action.options?.description ? ` — ${action.options.description}` : ''}`);
      ctx.hooks?.onTestCaseStart?.(action.name, action.options?.scene);
      return;

    case 'testCaseEnd':
      ctx.writer.writeLog({ type: 'test-case-end', name: action.name });
      console.log(`✓ ${action.name}`);
      ctx.hooks?.onTestCaseEnd?.(action.name);
      return;

    case 'preambleStart':
      ctx.writer.writeLog({
        type: 'preamble-start',
        name: action.name,
        description: action.description,
      });
      console.log(`  ⋯ setup: ${action.name}${action.description ? ` — ${action.description}` : ''}`);
      ctx.hooks?.onPreambleStart?.(action.name, action.description);
      return;

    case 'preambleEnd':
      ctx.writer.writeLog({ type: 'preamble-end', name: action.name });
      ctx.hooks?.onPreambleEnd?.(action.name);
      return;

    default: {
      // Exhaustiveness check.
      const _exhaustive: never = action;
      throw new Error(`Unhandled action type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// ─── Wait primitives ────────────────────────────────────────────────────────

function waitOneEvent(
  events: EventEmitter,
  name: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  return waitForCount(events, name, 1, signal);
}

/**
 * Per-wait safety net: if a wait sits idle longer than this, fail loud.
 *
 * 15s is generous — at ~20-30 PAI/sec, waiting for a hundred ticks takes
 * a few seconds. Anything past 15s means something is genuinely wrong
 * (server hung, client crashed, predicate broken). Better to fail fast
 * than to keep the user staring at a still client.
 */
const DEFAULT_WAIT_TIMEOUT_MS = 15_000;

function waitForCount(
  events: EventEmitter,
  name: string,
  count: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let seen = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    const cleanup = () => {
      events.removeListener(name, listener);
      signal?.removeEventListener('abort', onAbort);
      if (timeoutId) clearTimeout(timeoutId);
    };
    const onAbort = () => { cleanup(); reject(abortError()); };
    const listener = () => {
      seen++;
      if (seen >= count) { cleanup(); resolve(); }
    };
    if (signal?.aborted) { reject(abortError()); return; }
    signal?.addEventListener('abort', onAbort, { once: true });
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(
        `waitFor('${name}', ${count}) timed out after ${DEFAULT_WAIT_TIMEOUT_MS}ms — saw ${seen}/${count} events.`,
      ));
    }, DEFAULT_WAIT_TIMEOUT_MS);
    events.on(name, listener);
  });
}

function waitUntil(
  player: BedrockPlayerLike,
  predicate: WaitUntilPredicate,
  signal: AbortSignal | undefined,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let observed = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    const cleanup = () => {
      player.removeListener('serverbound', listener);
      signal?.removeEventListener('abort', onAbort);
      if (timeoutId) clearTimeout(timeoutId);
    };
    const onAbort = () => { cleanup(); reject(abortError()); };
    const listener = (packet: { name?: string; params?: unknown }) => {
      observed++;
      try {
        if (predicate(packet.name ?? '', packet.params)) {
          cleanup();
          resolve();
        }
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    if (signal?.aborted) { reject(abortError()); return; }
    signal?.addEventListener('abort', onAbort, { once: true });
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(
        `waitUntil(predicate) timed out after ${DEFAULT_WAIT_TIMEOUT_MS}ms — predicate never returned true (saw ${observed} packets).`,
      ));
    }, DEFAULT_WAIT_TIMEOUT_MS);
    player.on('serverbound', listener);
  });
}

/**
 * Wait until `silenceMs` of no chunk-data packets arrive, OR `maxWaitMs` total
 * has elapsed. The bedrock-protocol clientbound stream includes
 * `network_chunk_publisher_update` which fires roughly every PAI tick — it's
 * metadata, not chunk data, so we ignore it. Only `subchunk` and
 * `level_chunk` actually carry world geometry.
 */
function waitForChunkSilence(
  player: BedrockPlayerLike,
  silenceMs: number,
  signal: AbortSignal | undefined,
  maxWaitMs = 10_000,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let silenceTimer: NodeJS.Timeout | null = null;
    let maxTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (maxTimer) clearTimeout(maxTimer);
      player.removeListener('clientbound', listener);
      signal?.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const proceed = () => {
      cleanup();
      resolve();
    };
    const resetTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(proceed, silenceMs);
    };
    const listener = (packet: { name?: string }) => {
      // arg1 (des.data) has `.name`. We only watch the real chunk-data packets.
      // `network_chunk_publisher_update` is excluded — it's sent every PAI tick
      // and would prevent silence from ever being reached.
      const name = packet?.name;
      if (name === 'subchunk' || name === 'level_chunk') {
        resetTimer();
      }
    };

    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    // Defense in depth: if a misconfigured world keeps streaming chunks
    // forever, give up after `maxWaitMs` and proceed.
    maxTimer = setTimeout(() => {
      console.warn(`[bdt] waitUntilChunksLoaded: ${maxWaitMs}ms elapsed without ${silenceMs}ms silence; proceeding.`);
      proceed();
    }, maxWaitMs);

    player.on('clientbound', listener);
    resetTimer();
  });
}

// ─── Command send (encapsulates v2's version split) ─────────────────────────

/**
 * Bedrock's `command_request` payload changed at protocol ~944
 * (Bedrock 1.21.30-ish). v2 branches at simulation-builder.ts:391 — same logic
 * preserved here, centralized so future schema drifts hit one place.
 *
 * The UUIDs are static; bedrock-protocol's relay doesn't validate them, but if
 * a future server tightens this, swap to the player's real UUID.
 */
function sendCommand(player: BedrockPlayerLike, command: string): void {
  const protocolVer = player.version ?? 0;
  if (protocolVer < 944) {
    player.upstream.queue('command_request', {
      command,
      origin: {
        type: 'player',
        uuid: 'db4aa3a7-ed60-5bb0-827f-c2f90ad2ca8f',
        request_id: '',
      },
      internal: false,
      version: 78,
    });
  } else {
    player.upstream.queue('command_request', {
      command,
      origin: {
        type: 'player',
        uuid: 'db4aa3a7-ed60-5bb0-827f-c2f90ad2ca8f',
        request_id: '',
        player_entity_id: 0n,
      },
      internal: false,
      version: 'latest',
    });
  }
}
