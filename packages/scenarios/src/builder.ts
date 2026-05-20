import type {
  SimulationAction,
  SimulationSequence as SimulationSequenceShape,
  TestCaseOptions,
  WaitUntilPredicate,
  ExecutionContext,
  WorldScene,
} from '@bdt/core';

export interface ResetAndTeleportOptions {
  /** L-record name for the preamble. Default `'__preamble__'`. */
  name?: string;
  /** Human-readable description forwarded to the preamble-start L-record. */
  description?: string;
  /** Where the test case wants the player. Required. */
  startPos: { x: number; y: number; z: number };
  yaw?: number;
  pitch?: number;
  /** Default true. Runs `effect ${PLAYER} clear` first. */
  clearEffects?: boolean;
  /** Default true. Runs `effect ${PLAYER} resistance 9999 255 true`. */
  giveResistance?: boolean;
  /** Default true. Runs `clear ${PLAYER}`. */
  clearInventory?: boolean;
  /** Default true. Waits for chunk-load silence after the teleport. */
  waitForChunks?: boolean;
  /** Default true. Waits for the teleport handshake (handled_teleport flip). */
  waitForTeleport?: boolean;
  /** PAI ticks to wait at the end before the test case opens. Default 5. */
  settleTicks?: number;
}

/**
 * High-level options for `SimulationBuilder.sceneTestCase()`. See the method
 * docstring for the full flow.
 */
export interface SceneTestCaseOptions {
  /** Test case name (extractor uses as the generated `.test.js` filename). */
  name: string;
  /** Human-readable description for the test case (extractor stamps into `describe()`). */
  description?: string;
  /** Scene preset the case runs in. Lands in the L-record `scene` field. */
  scene?: WorldScene;
  /** Where the player should be when the recorded scenario begins. */
  startPos: { x: number; y: number; z: number };
  yaw?: number;
  pitch?: number;

  /** Free-form metadata to attach to the testCaseStart L-record. */
  meta?: Record<string, unknown>;

  /**
   * Optional setup actions that should land *inside* the recorded fixture
   * window (so the resulting fixture captures attribute/effect/item changes
   * as packets). Typical content: `effect`, `give`, `replaceitem`, `gamemode`.
   */
  setup?: (b: SimulationBuilder) => SimulationBuilder;
  /** Human-readable description of the setup; emitted as an L `note` `SETUP: <text>`. */
  setupDescription?: string;
  /** PAI ticks to wait *after* setup commands fire, before the START marker. Default 4. */
  setupSettleTicks?: number;

  /** The actual scenario actions (the meat of the test case). */
  run: (b: SimulationBuilder) => SimulationBuilder;
  /** PAI ticks to wait between the final teleport and `run`. Default 2. */
  preActionTicks?: number;
  /** PAI ticks to wait at the very end of the testCase. Default 5. */
  postActionTicks?: number;

  // ── Preamble (outside the fixture window) ──────────────────────────────

  /**
   * Scene anchor — the position used during world setup for this scene
   * (typically `(scene.x, 0, scene.z + scene.viewZ)`). When set, this becomes
   * the safe-zone position (with `safeZoneYOffset` added to y), so the
   * preamble teleport lands exactly where the world-prep stood — chunks
   * within render distance of that point are guaranteed loaded.
   *
   * Pass this for every fixture that pins to a specific scene; it gives the
   * recorder a per-scene safe-zone rather than one global fixed point.
   */
  sceneAnchor?: { x: number; y: number; z: number };
  /**
   * Explicit safe-zone position. If set, overrides `sceneAnchor` /
   * `safeZoneYOffset` and is used verbatim.
   */
  safeZone?: { x: number; y: number; z: number };
  /**
   * Y-offset added above `sceneAnchor` (or above `startPos` if no anchor)
   * for the default safe-zone. Default 0 — places the player at the exact
   * world-prep standing position (the scene's ground at y=0 with the actual
   * stone at y=-1). v2's `preloadScene` teleported to y=0 too, so this
   * matches the established behavior; the previous default of 32 caused a
   * pointless 32-block fall before every test case.
   */
  safeZoneYOffset?: number;
  /** Default true. Runs `effect ${PLAYER} clear` in the preamble. */
  clearEffects?: boolean;
  /** Default true. Runs `effect ${PLAYER} resistance 9999 255 true` in the preamble. */
  giveResistance?: boolean;
  /** Default true. Runs `clear ${PLAYER}` in the preamble. */
  clearInventory?: boolean;
  /** Default true. Waits for chunk-load silence after the safe-zone teleport. */
  waitForChunks?: boolean;
  /** PAI ticks to wait after the safe-zone teleport (handshake). Default 8. */
  preambleSettleTicks?: number;
}

/**
 * The fluent DSL. Mirrors v2's `SimulationBuilder` but:
 *   - keys are strings (KeyName) — the runtime resolves to VKs via @bdt/native-input.
 *   - the `1.21.0_` hardcoded prefix on testCase names is gone; the writer stamps the version.
 *   - `build()` returns a real `SimulationSequence` that takes an `ExecutionContext`.
 */
export class SimulationBuilder {
  private _actions: SimulationAction[] = [];

  /**
   * Read-only view of the action stream. Public so a `SimulationBuilder`
   * instance structurally satisfies `BeforeEachCaseResult` (the shape
   * `Fixture.beforeEachCase` returns).
   */
  get actions(): readonly SimulationAction[] {
    return this._actions;
  }

  waitFor(event: string, count = 1): this {
    this._actions.push({ type: 'wait', event, count });
    return this;
  }

  log(message: string): this {
    this._actions.push({ type: 'log', message });
    return this;
  }

  sleep(ms: number): this {
    this._actions.push({ type: 'sleep', ms });
    return this;
  }

  teleport(x: number, y: number, z: number, yaw?: number, pitch?: number): this {
    this._actions.push({ type: 'teleport', x, y, z, yaw, pitch });
    return this;
  }

  keyDown(...keys: string[]): this {
    this._actions.push({ type: 'keyDown', keys });
    return this;
  }

  keyUp(...keys: string[]): this {
    this._actions.push({ type: 'keyUp', keys });
    return this;
  }

  mouseMove(x: number, y: number): this {
    this._actions.push({ type: 'mouseMove', x, y });
    return this;
  }

  mouseClick(button: 'left' | 'right' | 'middle' = 'left'): this {
    this._actions.push({ type: 'mouseClick', button });
    return this;
  }

  /**
   * Append a Minecraft slash command (sent through the recording client via
   * bedrock-protocol's `command_request`).
   *
   * Use `${PLAYER}` to refer to the recorder's own username — the executor
   * substitutes from `config.relay.username` at run time. Keep `@a` only
   * when you genuinely want every connected player; the recorder is
   * single-client by design, so `${PLAYER}` is almost always correct.
   *
   *   .command('op ${PLAYER}')                         // not 'op @a'
   *   .command('give ${PLAYER} diamond_sword 2')       // not 'give @a ...'
   *   .command('effect ${PLAYER} water_breathing 9999 0 true')
   *
   * See `util/substitute.ts` for the substitution rules.
   */
  command(command: string): this {
    this._actions.push({ type: 'command', command });
    return this;
  }

  waitUntil(predicate: WaitUntilPredicate): this {
    this._actions.push({ type: 'waitUntil', predicate });
    return this;
  }

  waitUntilChunksLoaded(): this {
    this._actions.push({ type: 'waitUntilChunksLoaded' });
    return this;
  }

  /**
   * Wait until the player's delta (velocity) goes to zero after at least `minEvents`
   * PAI ticks. Useful as "let the player come to rest" after a movement.
   *
   * Ported from v2 simulation-builder.ts:139-151.
   */
  waitUntilStopped(minEvents = 7): this {
    let count = 0;
    const predicate: WaitUntilPredicate = (name, packet) => {
      if (name !== 'player_auth_input') return false;
      count++;
      const pai = packet as { delta: { x: number; z: number } };
      return count >= minEvents && pai.delta.x === 0 && pai.delta.z === 0;
    };
    // 'proceed' on timeout: scenarios like slime bounces or bubble columns
    // legitimately keep moving past the 15s budget — partial PAI capture is
    // still useful, so log + continue rather than aborting the whole bundle.
    this._actions.push({ type: 'waitUntil', predicate, onTimeout: 'proceed', kind: 'stopped', args: { minEvents } });
    return this;
  }

  /**
   * Wait until the player's delta stabilizes (two consecutive PAI ticks with
   * delta change < 0.01 on every axis), after at least `minEvents` ticks.
   *
   * Ported from v2 simulation-builder.ts:187-207.
   */
  waitUntilStable(minEvents = 5): this {
    let last: { delta: { x: number; y: number; z: number } } | undefined;
    let count = 0;
    const predicate: WaitUntilPredicate = (name, packet) => {
      if (name !== 'player_auth_input') return false;
      const pai = packet as { delta: { x: number; y: number; z: number } };
      count++;
      if (
        count >= minEvents &&
        last !== undefined &&
        Math.abs(last.delta.x - pai.delta.x) < 0.01 &&
        Math.abs(last.delta.y - pai.delta.y) < 0.01 &&
        Math.abs(last.delta.z - pai.delta.z) < 0.01
      ) {
        return true;
      }
      last = { delta: pai.delta };
      return false;
    };
    this._actions.push({ type: 'waitUntil', predicate, onTimeout: 'proceed', kind: 'stable', args: { minEvents } });
    return this;
  }

  /**
   * Wait for the full client-side teleport handshake:
   *   1. PAI with handled_teleport=true
   *   2. PAI with handled_teleport=false
   *   3. `minMovingTicks` ticks where the position changes
   *
   * Useful after `.teleport()` to ensure the client is fully synced before
   * the next test case.
   *
   * Ported from v2 simulation-builder.ts:159-185.
   */
  waitUntilTeleportHandled(minMovingTicks = 5): this {
    let state: 'waiting_for_handled' | 'waiting_for_unhandled' | 'moving' = 'waiting_for_handled';
    let movingTicks = 0;
    let lastPos: { x: number; y: number; z: number } | undefined;
    const predicate: WaitUntilPredicate = (name, packet) => {
      if (name !== 'player_auth_input') return false;
      const pai = packet as {
        position: { x: number; y: number; z: number };
        input_data?: { handled_teleport?: boolean };
      };
      const handled = pai.input_data?.handled_teleport === true;
      if (state === 'waiting_for_handled' && handled) {
        state = 'waiting_for_unhandled';
      } else if (state === 'waiting_for_unhandled' && !handled) {
        state = 'moving';
        lastPos = pai.position;
      } else if (state === 'moving') {
        if (
          lastPos &&
          (Math.abs(pai.position.x - lastPos.x) > 0.0001 ||
            Math.abs(pai.position.z - lastPos.z) > 0.0001)
        ) {
          movingTicks++;
        }
        lastPos = pai.position;
        return movingTicks >= minMovingTicks;
      }
      return false;
    };
    this._actions.push({ type: 'waitUntil', predicate, onTimeout: 'proceed', kind: 'teleportHandled', args: { minMovingTicks } });
    return this;
  }

  /**
   * Wraps the actions emitted by `builderFn` in `testCaseStart`/`testCaseEnd`
   * brackets. Downstream `extract-physics-fixtures.ts` slices the stream on
   * these brackets.
   *
   * Add `options.description` for a human-readable summary that the
   * extractor stamps into the generated test file's `describe()` block.
   */
  testCase(
    name: string,
    builderFn: (b: SimulationBuilder) => SimulationBuilder,
    options?: TestCaseOptions,
  ): this {
    const inner = new SimulationBuilder();
    builderFn(inner);

    this._actions.push({ type: 'testCaseStart', name, options });
    this._actions.push(...inner.actions);
    this._actions.push({ type: 'testCaseEnd', name });
    return this;
  }

  /**
   * Bracket a block of setup actions with `preamble-start` / `preamble-end`
   * L-records. PAI captured during the preamble lives in the *gap between*
   * test cases — the extractor's case-windowing pass naturally ignores it.
   *
   * Use for per-test setup: teleport to start position, clear inventory,
   * apply effects, wait for chunks. The L-record markers are informational
   * (free-form for v2 extractor; semantic for v5-aware tools).
   *
   * Prefer `resetAndTeleport()` for the common "reset between cases" flow —
   * it composes the right primitives in the right order.
   */
  preamble(
    name: string,
    builderFn: (b: SimulationBuilder) => SimulationBuilder,
    options?: { description?: string },
  ): this {
    const inner = new SimulationBuilder();
    builderFn(inner);

    this._actions.push({ type: 'preambleStart', name, description: options?.description });
    this._actions.push(...inner.actions);
    this._actions.push({ type: 'preambleEnd', name });
    return this;
  }

  /**
   * Common "reset between cases" sequence, wrapped in a `preamble()` block so
   * none of it lands inside the fixture's PAI window.
   *
   * Flow (each step gated by its option, default-on):
   *   1. `effect ${PLAYER} clear`            — drop lingering effects
   *   2. `effect ${PLAYER} resistance ...`   — prevent fall damage during teleport
   *   3. `clear ${PLAYER}`                   — empty inventory
   *   4. teleport(startPos, yaw, pitch)      — place at known position
   *   5. waitUntilChunksLoaded()             — let chunks settle so the test
   *                                            case starts from a stable state
   *   6. waitUntilTeleportHandled()          — confirm client has applied the tp
   *   7. waitFor('player_auth_input', 5)     — a few ticks of stable PAI
   *
   * Any disabled step is skipped; the rest run in this order.
   */
  resetAndTeleport(opts: ResetAndTeleportOptions): this {
    const {
      name = '__preamble__',
      description,
      startPos,
      yaw = 0,
      pitch = 0,
      clearEffects = true,
      giveResistance = true,
      clearInventory = true,
      waitForChunks = true,
      waitForTeleport = true,
      settleTicks = 5,
    } = opts;

    return this.preamble(
      name,
      (b) => {
        if (clearEffects)   b.command('effect ${PLAYER} clear');
        if (giveResistance) b.command('effect ${PLAYER} resistance 9999 255 true');
        if (clearInventory) b.command('clear ${PLAYER}');
        b.teleport(startPos.x, startPos.y, startPos.z, yaw, pitch);
        // After the teleport command goes through, BDS sends move_player +
        // the client replies with PAI(handled_teleport=true) then PAI(false).
        // We can't reliably *observe* that handshake from a listener added
        // here — the listener is wired after the command is sent, so the
        // handshake may have already flown. Instead we wait a deterministic
        // number of PAI ticks, which works because PAI flows continuously.
        if (waitForTeleport) b.waitFor('player_auth_input', 8);
        if (waitForChunks)   b.waitUntilChunksLoaded();
        if (settleTicks > 0) b.waitFor('player_auth_input', settleTicks);
        return b;
      },
      { description },
    );
  }

  /**
   * Scene-bound test case with full pre-flight and in-window setup.
   *
   * Flow (each phase shows what the recorded fixture window sees):
   *
   * ┌─ PREAMBLE (excluded from fixture window via preamble-start/end) ─┐
   * │ 1. clear ${PLAYER}                                                │
   * │ 2. effect ${PLAYER} clear                                         │
   * │ 3. effect ${PLAYER} resistance 9999 255 true   (fall safety)      │
   * │ 4. teleport ${PLAYER} → safe zone (y=200 above startPos)          │
   * │ 5. wait PAI 8 (teleport handshake)                                │
   * │ 6. waitUntilChunksLoaded                                          │
   * └───────────────────────────────────────────────────────────────────┘
   * ┌─ TEST CASE (recorded — every packet here lands in the fixture) ──┐
   * │ 7. log 'SETUP: <setupDescription>'                                │
   * │ 8. <setup actions>           (effect/give/replaceitem etc.)       │
   * │ 9. wait PAI 4 (attribute updates settle)                          │
   * │ A. log 'START: <description>'                                     │
   * │ B. teleport ${PLAYER} → startPos                                  │
   * │ C. wait PAI 2 (user spec — minimal warm-up)                       │
   * │ D. <run actions>             (the actual scenario)                │
   * │ E. wait PAI 5 (let final packets flow)                            │
   * └───────────────────────────────────────────────────────────────────┘
   *
   * The two L `note` records (`SETUP:`/`START:`) plus the testCaseStart
   * `description` give downstream tools three layers of context for the
   * generated fixture.
   */
  sceneTestCase(opts: SceneTestCaseOptions): this {
    const {
      name,
      description,
      scene,
      startPos,
      yaw = 0,
      pitch = 0,
      meta,
      setup,
      setupDescription,
      setupSettleTicks = 4,
      run,
      preActionTicks = 2,
      postActionTicks = 5,
      sceneAnchor,
      safeZone,
      safeZoneYOffset = 0,
      clearEffects = true,
      giveResistance = true,
      clearInventory = true,
      waitForChunks = true,
      preambleSettleTicks = 8,
    } = opts;

    // Safe-zone resolution:
    //   1. explicit `safeZone` wins
    //   2. else `sceneAnchor` + Y-offset — the world-prep standing spot. This
    //      is ALWAYS on the scene's platform (anchor.y is the standing
    //      position, typically y=0). High-altitude scenarios (elytra at
    //      y=200/300) put the player IN AIR via the setup preamble's
    //      teleport-to-startPos — not by lifting the safe zone. Otherwise
    //      the player free-falls through the entire reset window.
    //   3. else column at startPos's xz, but clamped to y=0 minimum so we
    //      never teleport below the world.
    const safe = safeZone ?? (sceneAnchor
      ? { x: sceneAnchor.x, y: sceneAnchor.y + safeZoneYOffset, z: sceneAnchor.z }
      : { x: startPos.x, y: Math.max(startPos.y, 0) + safeZoneYOffset, z: startPos.z });
    const preambleDesc =
      `Reset for ${name}: safe-zone @ (${safe.x},${safe.y},${safe.z}), clear inv/effects, wait chunks loaded`;

    // ── Phase 1: preamble (excluded from fixture window) ──────────────
    this.preamble(
      `${name}_reset`,
      (b) => {
        if (clearInventory) b.command('clear ${PLAYER}');
        if (clearEffects)   b.command('effect ${PLAYER} clear');
        if (giveResistance) b.command('effect ${PLAYER} resistance 9999 255 true');
        b.teleport(safe.x, safe.y, safe.z, yaw, pitch);
        if (preambleSettleTicks > 0) b.waitFor('player_auth_input', preambleSettleTicks);
        if (waitForChunks) b.waitUntilChunksLoaded();
        return b;
      },
      { description: preambleDesc },
    );

    // ── Phase 2: setup preamble (excluded from fixture window) ────────
    //
    // SETUP commands (effects, give, replaceitem) and the final teleport to
    // `startPos` happen here, OUTSIDE the recorded test-case window. This
    // keeps the .test.js TICKS array tight: TICKS[0] is the first PAI tick
    // after the player has teleported to startPos and warmed up — no leading
    // "still at safe zone" idle frames, no handledTeleport flag noise.
    this.preamble(
      `${name}_setup`,
      (b) => {
        b.log(`SETUP: ${setupDescription ?? description ?? name}`);
        if (setup) setup(b);
        if (setupSettleTicks > 0) b.waitFor('player_auth_input', setupSettleTicks);

        b.log(`START: ${description ?? name}`);
        b.teleport(startPos.x, startPos.y, startPos.z, yaw, pitch);
        if (preActionTicks > 0) b.waitFor('player_auth_input', preActionTicks);
        return b;
      },
      { description: `Setup ${name}: ${setupDescription ?? description ?? name}` },
    );

    // ── Phase 3: recorded test case (just the scenario action) ────────
    const tcMeta = {
      ...(meta ?? {}),
      ...(setupDescription ? { setupDescription } : {}),
    };

    this.testCase(
      name,
      (b) => {
        run(b);
        if (postActionTicks > 0) b.waitFor('player_auth_input', postActionTicks);
        return b;
      },
      {
        startPos,
        description,
        scene,
        meta: Object.keys(tcMeta).length > 0 ? tcMeta : undefined,
      },
    );

    return this;
  }

  /** Append the actions of another builder verbatim (no test-case wrapping). */
  include(other: SimulationBuilder): this {
    this._actions.push(...other.actions);
    return this;
  }

  build(): SimulationSequence {
    return new SimulationSequence([...this.actions]);
  }

  /** For tests/inspection — returns the raw action stream. */
  toActions(): readonly SimulationAction[] {
    return this.actions;
  }
}

/**
 * A built sequence. Execution lives in `./executor.ts` so the action ADT and
 * the (async) interpreter stay separable — tests can construct sequences
 * without touching the executor, and the executor can be replaced (e.g. for
 * a future deterministic replay mode) without changing the action shape.
 */
export class SimulationSequence implements SimulationSequenceShape {
  readonly actions: readonly SimulationAction[];

  constructor(actions: SimulationAction[]) {
    this.actions = actions;
  }

  async execute(ctx: ExecutionContext): Promise<void> {
    const { executeSequence } = await import('./executor.js');
    await executeSequence(this.actions, ctx);
  }
}
