import type { Vec3, WorldScene } from './scene.js';
import type { ExecutionContext } from './execution-context.js';

export type WaitUntilPredicate = (packetName: string, packet: unknown) => boolean;

/**
 * The serializable action stream that a `SimulationBuilder` produces.
 *
 * Keeping this as a flat ADT (vs. closures bound to a builder) makes it
 * trivial to:
 *   - inspect a sequence for tests/diagnostics without running it
 *   - serialize to JSON for cross-process replay (Phase 4)
 *
 * Note `waitUntil` carries a closure — those sequences are not serializable.
 * That's the price for the ergonomic API; predicate-free sequences round-trip fine.
 */
export type SimulationAction =
  | { type: 'wait'; event: string; count: number }
  | { type: 'log'; message: string }
  | { type: 'teleport'; x: number; y: number; z: number; yaw?: number; pitch?: number }
  | { type: 'keyDown'; keys: string[] }
  | { type: 'keyUp'; keys: string[] }
  | { type: 'mouseMove'; x: number; y: number }
  | { type: 'mouseClick'; button: 'left' | 'right' | 'middle' }
  | { type: 'command'; command: string }
  | { type: 'waitUntil'; predicate: WaitUntilPredicate; onTimeout?: 'fail' | 'proceed'; kind?: string; args?: Record<string, unknown> }
  | { type: 'waitUntilChunksLoaded' }
  | { type: 'sleep'; ms: number }
  | { type: 'testCaseStart'; name: string; options?: TestCaseOptions }
  | { type: 'testCaseEnd'; name: string }
  | { type: 'preambleStart'; name: string; description?: string }
  | { type: 'preambleEnd'; name: string };

export interface TestCaseOptions {
  scene?: WorldScene;
  startPos?: Vec3;
  /** Set true to mark this case as warmup; downstream extractor filters preload windows. */
  preload?: boolean;
  /**
   * Human-readable description of what this case exercises. Forwarded into
   * the `test-case-start` L-record so the extractor can stamp a `describe()`
   * block in the generated test file. Optional.
   */
  description?: string;
  /** Free-form metadata stamped into the L-record for the extractor to read. */
  meta?: Record<string, unknown>;
}

/**
 * A built, runnable sequence. The actual class lives in `@bdt/scenarios`,
 * but `@bdt/bds-adapter` consumes only this structural shape.
 */
export interface SimulationSequence {
  readonly actions: readonly SimulationAction[];
  execute(ctx: ExecutionContext): Promise<void>;
}

export interface Fixture {
  /** Used for the .proxy.bin filename and the surrounding L-record. */
  name: string;
  description?: string;
  sequences: SimulationSequence[];
  /** Optional list of scene presets this fixture relies on (for setup-once-world flows). */
  scenes?: WorldScene[];
  /**
   * Optional per-case setup hook. When present, runFixture injects the
   * returned actions before every `testCaseStart` in this fixture's sequences,
   * wrapped in a `preamble()` block (so the PAI stream during setup lives
   * outside any test case window and the extractor skips it).
   *
   * Use for shared concerns like:
   *   - clearing inventory + effects between cases
   *   - teleporting to the case's `startPos`
   *   - waiting for chunks before the test case window opens
   *
   * Return `null` (or an empty builder) to skip setup for a particular case.
   */
  beforeEachCase?: (info: { name: string; options?: TestCaseOptions }) =>
    BeforeEachCaseResult | null;
}

/**
 * Returned by `Fixture.beforeEachCase`. Either a builder-like with an
 * `actions` field (e.g. a `SimulationBuilder` instance) or a raw action list.
 * Keeping this structural so `@bdt/core` doesn't need to import scenarios.
 */
export interface BeforeEachCaseResult {
  readonly actions: readonly SimulationAction[];
}
