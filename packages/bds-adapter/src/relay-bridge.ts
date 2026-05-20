import { EventEmitter } from 'node:events';
// bedrock-protocol's TypeScript types are loose; we accept the runtime shape.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { Relay } = require('bedrock-protocol') as any;
import type { Fixture, BedrockPlayerLike, SimulationAction, BeforeEachCaseResult, TestCaseOptions } from '@bdt/core';
import type { VersionConfig } from './config.js';
import type { PacketDumpWriter } from './dump-writer.js';

export interface RelayBridgeOptions {
  host: string;
  port: number;
  bdsHost: string;
  bdsPort: number;
  username: string;
  profilesFolder: string;
  versionConfig: VersionConfig;
}

export interface ConnectedRelay {
  player: BedrockPlayerLike;
  /** Per-packet-name event channel. Emits with the deserialized `params` payload. */
  events: EventEmitter;
  /** Resolves when the relay disconnects or `close()` is called. */
  done: Promise<void>;
}

/**
 * A bedrock-protocol Relay configured per `bdt.config.json`'s `relay` block,
 * forwarding to a local BDS. v2's wiring lives at `recorder/src/main.ts:509-606`;
 * this is the same logic factored out of the god-module.
 *
 * Vs v2:
 *   - Username/profilesFolder come from options (not hardcoded).
 *   - `connect()` returns a `ConnectedRelay` rather than threading a callback
 *     so callers can `await` the connection naturally.
 *   - Cleanup is reliable: `close()` always tears down listeners, even if BDS
 *     dies first.
 */
export class RelayBridge {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private relay: any;
  private writer: PacketDumpWriter | null = null;
  private events: EventEmitter | null = null;
  private connected = false;
  private closed = false;
  private doneResolve: (() => void) | null = null;
  private donePromise: Promise<void>;

  constructor(private readonly opts: RelayBridgeOptions) {
    this.donePromise = new Promise<void>((resolve) => { this.doneResolve = resolve; });
  }

  /**
   * Start listening for a client. Returns a Promise that resolves on the first
   * client connection, yielding the bridge state used by the executor.
   */
  start(writer: PacketDumpWriter): Promise<ConnectedRelay> {
    if (this.relay) throw new Error('RelayBridge.start: already started');
    this.writer = writer;
    this.events = new EventEmitter();
    this.events.setMaxListeners(100);

    this.relay = new Relay({
      version: this.opts.versionConfig.protocolVersion,
      host: this.opts.host,
      port: this.opts.port,
      enableChunkCaching: false,
      offline: true,
      username: this.opts.username,
      profilesFolder: this.opts.profilesFolder,
      destination: {
        host: this.opts.bdsHost,
        port: this.opts.bdsPort,
        offline: true,
      },
    });

    return new Promise<ConnectedRelay>((resolve, reject) => {
      this.relay.on('error', (err: Error) => {
        console.error('[bdt] relay error:', err);
        if (!this.connected) reject(err);
      });

      this.relay.on('disconnect', () => {
        console.log('[bdt] relay disconnect');
        this.signalDone();
      });

      this.relay.on('connect', (player: BedrockPlayerLike) => {
        if (this.connected) {
          // Multiple clients connecting to the same relay is undefined behavior
          // for our recorder — single-client by design.
          console.warn('[bdt] secondary client connection ignored');
          return;
        }
        this.connected = true;
        this.wirePacketHandlers(player);
        resolve({
          player,
          events: this.events!,
          done: this.donePromise,
        });
      });

      this.relay.listen?.();
    });
  }

  /** Tear down the Relay listeners and resolve the `done` Promise. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.relay as any)?.close?.();
    } catch (err) {
      console.warn('[bdt] error closing relay:', err);
    }
    this.signalDone();
  }

  private signalDone(): void {
    if (this.doneResolve) {
      this.doneResolve();
      this.doneResolve = null;
    }
  }

  private wirePacketHandlers(player: BedrockPlayerLike): void {
    // bedrock-protocol's `serverbound`/`clientbound` listeners receive
    // `(packet, fullPacket)` where `fullPacket` exposes `.data.name`,
    // `.data.params`, and `.fullBuffer`. Match v2's shape (main.ts:575-589).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (player as any).on('clientbound', (_: unknown, des: { fullBuffer: Buffer }) => {
      this.writer?.writeClientbound(des.fullBuffer);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (player as any).on('serverbound', (_: unknown, des: { data: { name: string; params: unknown }; fullBuffer: Buffer }) => {
      this.writer?.writeServerbound(des.fullBuffer);
      this.events?.emit(des.data.name, des.data.params);
    });
  }
}

/**
 * One-shot helper: drive an entire fixture through a connected relay,
 * awaiting each sequence in turn. Replaces v2's reactive
 * "check on every PAI whether to start the next sequence" pattern
 * at main.ts:592-604.
 *
 * If `fixture.beforeEachCase` is set, the action stream of each sequence is
 * transformed: the hook's returned actions are spliced in *just before* every
 * `testCaseStart` action, wrapped in their own `preamble()` block. This lets
 * fixtures opt into automatic per-case reset (clear inventory, teleport, etc.)
 * without rewriting every test factory.
 */
export async function runFixture(
  fixture: Fixture,
  connection: ConnectedRelay,
  writer: PacketDumpWriter,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  vars: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<void> {
  writer.writeLog({ type: 'fixture', name: fixture.name, description: fixture.description });

  // Lazy-load the SimulationSequence class so we can re-wrap transformed
  // action streams without making bds-adapter depend on scenarios at the
  // type level.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const { SimulationSequence }: { SimulationSequence: any } = require('@bdt/scenarios');

  for (let i = 0; i < fixture.sequences.length; i++) {
    const seq = fixture.sequences[i]!;
    console.log(`[bdt] sequence ${i + 1}/${fixture.sequences.length}`);

    const actions = fixture.beforeEachCase
      ? injectBeforeEachCase(seq.actions, fixture.beforeEachCase)
      : seq.actions;

    const toRun = actions === seq.actions ? seq : new SimulationSequence([...actions]);

    await toRun.execute({
      events: connection.events,
      player: connection.player,
      writer,
      input,
      vars,
      signal,
    });
  }
}

/**
 * Walk an action stream; for every `testCaseStart`, splice in a preamble
 * built from `hook(caseInfo)` immediately before it. The preamble is wrapped
 * in `preambleStart`/`preambleEnd` markers so the PAI captured during the
 * setup is logically separate from the case window.
 *
 * Returns the original array if the hook never produces actions (cheap no-op).
 */
function injectBeforeEachCase(
  actions: readonly SimulationAction[],
  hook: NonNullable<Fixture['beforeEachCase']>,
): readonly SimulationAction[] {
  const out: SimulationAction[] = [];
  let changed = false;

  for (const action of actions) {
    if (action.type === 'testCaseStart') {
      const result = hook({ name: action.name, options: action.options });
      const inserted = preludeActions(result, action.name, action.options);
      if (inserted.length > 0) {
        out.push(...inserted);
        changed = true;
      }
    }
    out.push(action);
  }
  return changed ? out : actions;
}

function preludeActions(
  result: BeforeEachCaseResult | null,
  caseName: string,
  caseOptions: TestCaseOptions | undefined,
): readonly SimulationAction[] {
  if (!result || result.actions.length === 0) return [];
  // Guard against accidental nesting: if the hook already returned a
  // preamble-bracketed block, don't double-wrap.
  const first = result.actions[0];
  if (first?.type === 'preambleStart') return result.actions;

  const preambleName = `__before_${caseName}__`;
  const description =
    caseOptions?.description !== undefined
      ? `setup for ${caseName}: ${caseOptions.description}`
      : `setup for ${caseName}`;
  return [
    { type: 'preambleStart', name: preambleName, description },
    ...result.actions,
    { type: 'preambleEnd', name: preambleName },
  ];
}
