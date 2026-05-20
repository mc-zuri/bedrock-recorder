import type { EventEmitter } from 'node:events';
import type { WorldScene } from './scene.js';
import type { LogRecord } from './dump-format.js';

/**
 * The shape `@bdt/bds-adapter` passes to a `SimulationSequence.execute(ctx)`.
 *
 * This is the one breaking change vs v2's `execute(events, player, writer, input)` —
 * passing options as an object lets every future capability (vision, cancellation,
 * direct fixture emission) land without changing the signature again.
 */
export interface ExecutionContext {
  /**
   * Per-packet-name event channel populated by the relay-bridge. The executor
   * uses this for `waitFor('player_auth_input', N)`-style counting.
   * Listeners receive a single `payload` argument (the deserialized packet).
   */
  events: EventEmitter;
  /** bedrock-protocol Player handle. Typed structurally to keep @bdt/core dep-free. */
  player: BedrockPlayerLike;
  /** The dump sink. */
  writer: DumpWriterLike;
  /** Compiled InputController from @bdt/native-input. */
  input: InputControllerLike;
  signal?: AbortSignal;
  hooks?: ExecutionHooks;
  /**
   * Template variables for `${VAR}` substitution in command strings.
   * The CLI/relay-bridge populates `{ PLAYER: config.relay.username }`.
   */
  vars?: Record<string, string | undefined>;
}

export interface ExecutionHooks {
  onTestCaseStart?(name: string, scene?: WorldScene): void;
  onTestCaseEnd?(name: string): void;
  onPreambleStart?(name: string, description?: string): void;
  onPreambleEnd?(name: string): void;
  onActionBegin?(actionType: string, index: number): void;
  onActionEnd?(actionType: string, index: number): void;
}

/**
 * Structural subset of bedrock-protocol's Player so @bdt/core stays dep-free.
 * The real one is loaded at runtime; this is just enough for the executor to type-check.
 */
export interface BedrockPlayerLike {
  version?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, listener: (...args: any[]) => void): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeListener(event: string, listener: (...args: any[]) => void): unknown;
  /** The relay forwards through `upstream.queue(name, payload)`. */
  upstream: {
    queue(packetName: string, payload: unknown): void;
  };
}

/** Structural subset of the writer. The real one is in @bdt/bds-adapter. */
export interface DumpWriterLike {
  writeLog(record: LogRecord): void;
  /** Convenience: log a free-form message as a `note` L-record. */
  writeNote(message: string): void;
}

/** Structural subset of @bdt/native-input InputController. */
export interface InputControllerLike {
  keyDown(key: string | number): void;
  keyUp(key: string | number): void;
  keyDownMultiple(keys: (string | number)[]): void;
  keyUpMultiple(keys: (string | number)[]): void;
  mouseDown(button?: 'left' | 'right' | 'middle'): void;
  mouseUp(button?: 'left' | 'right' | 'middle'): void;
  mouseClick(button?: 'left' | 'right' | 'middle'): void;
  mouseMove(dx: number, dy: number): void;
  mouseWheel(delta: number): void;
}
