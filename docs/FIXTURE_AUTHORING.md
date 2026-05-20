# Fixture authoring

A **fixture** is a named bundle of `SimulationSequence`s that the recorder
runs sequentially against a live Minecraft client. Each fixture file in
`packages/scenarios/src/fixtures/` registers itself via `registerFixture()`
at import time. The `bdt record --fixture <name>` CLI looks the name up in
the process-global registry and runs it.

## Minimum viable fixture

```ts
// packages/scenarios/src/fixtures/my_fixture.ts
import { SimulationBuilder } from '../builder.js';
import { registerFixture } from './registry.js';

registerFixture({
  name: 'my_fixture',
  description: 'Walk forward for 20 ticks.',
  sequences: [
    new SimulationBuilder()
      .testCase('walk_forward_20t', (b) =>
        b.keyDown('w')
         .waitFor('player_auth_input', 20)
         .keyUp('w')
         .waitUntilStable())
      .build(),
  ],
});
```

Then add `import './my_fixture.js';` to `packages/scenarios/src/fixtures/index.ts`
so the barrel import registers it.

`bdt list-fixtures` then shows it; `bdt record --fixture my_fixture` runs it.

## `SimulationBuilder` API

The DSL is chainable — every method returns `this`. Lives in
`packages/scenarios/src/builder.ts`.

### Input

| Method | Effect |
|---|---|
| `keyDown(...keys)` | Press keys (held). `keys` are `KeyName` strings (`'w'`, `'shift'`, `'ctrl'`, `'space'`, `'enter'`, function keys, OEM keys — see `@bdt/native-input/ts/keys.ts`). |
| `keyUp(...keys)` | Release keys. |
| `mouseMove(dx, dy)` | Relative mouse move (`MOUSEEVENTF_MOVE`). |
| `mouseClick(button?)` | Left (default), right, or middle. Splits down/up across one PAI tick for click reliability. |

### Commands & teleport

| Method | Effect |
|---|---|
| `command(cmd)` | Sends `command_request` via the relay. Substitutes `${PLAYER}` → `@s` at run time. Use `@a` literal when you genuinely want all players. |
| `teleport(x, y, z, yaw?, pitch?)` | Issues `teleport ${PLAYER} <x> <y> <z> <yaw> <pitch>`. |

```ts
.command('give ${PLAYER} diamond_sword 2')
.command('effect ${PLAYER} water_breathing 9999 0 true')
.command('say hello')                    // no substitution needed
.command('op @a')                        // literal @a — all-players selector
```

### Waits

| Method | Effect | Timeout |
|---|---|---|
| `waitFor(event, count)` | Wait for `count` events with the given name on the per-packet event channel (e.g. `'player_auth_input'`). | 15s |
| `waitUntil(predicate)` | Wait until `predicate(name, params)` returns true on the next serverbound packet. | 15s |
| `waitUntilChunksLoaded()` | Wait for 500ms of silence on clientbound `subchunk` + `level_chunk`. | 10s |
| `waitUntilStopped(minEvents=7)` | Convenience: wait until PAI delta = 0 for ≥ minEvents. | 15s |
| `waitUntilStable(minEvents=5)` | Wait until two consecutive PAI ticks have delta change < 0.01. | 15s |
| `waitUntilTeleportHandled(minMovingTicks=5)` | Wait for `handled_teleport=true → false` then `minMovingTicks` of position change. Note: the handshake fires during the teleport command — only reliable if the listener was already attached. Prefer `waitFor('player_auth_input', 8)` for setup-time use. | 15s |
| `sleep(ms)` | Hard sleep. Use sparingly — prefer event-driven waits. | — |
| `log(msg)` | Writes a `note` L-record to the dump. No wait. | — |

### Test-case bracketing

```ts
.testCase('case_name', (b) =>
  b.keyDown('w').waitFor('player_auth_input', 10).keyUp('w'),
  { startPos: { x: 0, y: 0, z: 0 }, description: 'walk forward 10 ticks' }
)
```

Emits `testCaseStart` / `testCaseEnd` L-records that the extractor uses to
slice the PAI stream into per-case fixtures. The `description` field lands
in the L-record so the extractor can stamp the generated test file's
`describe(...)`.

`TestCaseOptions`:

| Field | Purpose |
|---|---|
| `scene` | Mark the test case as set in a named scene (e.g. `'water_pool'`). |
| `startPos` | Where the player should be when the case opens. |
| `preload` | Mark as warmup; downstream extractor filters preload windows. |
| `description` | Human-readable summary for the generated `describe()` block. |
| `meta` | Free-form metadata stamped into the L-record. |

### Preamble (setup outside the recorded window)

```ts
.preamble('reset', (b) =>
  b.command('clear ${PLAYER}')
   .command('effect ${PLAYER} clear'),
  { description: 'wipe inventory + effects' }
)
.testCase('actual_test', (b) => ...)
```

`preamble()` emits `preamble-start` / `preamble-end` L-records that the
extractor's case-windowing pass ignores. PAI captured during the preamble
lives in the gap between test cases and isn't part of any fixture window.

### `sceneTestCase` — the canonical test case recipe

`sceneTestCase()` is the high-level wrapper used by every ported v2 fixture.
It composes a preamble (excluded from the recorded window) with a recorded
test case that includes its own setup commands so the fixture captures
effect/item/attribute packets.

```ts
new SimulationBuilder()
  .sceneTestCase({
    name:               'walk_with_speed1',
    description:        'Walk forward 20t with Speed I',
    setupDescription:   'apply Speed I',
    sceneAnchor:        sceneAnchor(SCENES.flat),     // per-scene safe-zone column
    startPos:           { x: 0, y: 0, z: 0 },
    yaw:                0,
    setup: (b) => b.command('effect ${PLAYER} speed 30 0 true'),
    run:   (b) => b.keyDown('w').waitFor('player_auth_input', 20).keyUp('w'),
  })
  .build();
```

What lands in the dump:

```
PREAMBLE (preamble-start/end — extractor ignores)
  clear ${PLAYER}
  effect ${PLAYER} clear
  effect ${PLAYER} resistance 9999 255 true
  teleport ${PLAYER} → sceneAnchor + Y-offset (default +32)
  waitFor player_auth_input × 8         (teleport handshake)
  waitUntilChunksLoaded                  (silence-based; 10s ceiling)

TEST CASE (test-case-start/end — recorded into fixture)
  note: SETUP: apply Speed I            (free-form L-record)
  effect ${PLAYER} speed 30 0 true      (← attribute_set packets captured)
  waitFor player_auth_input × 4         (let attribute updates settle)
  note: START: Walk forward 20t with Speed I
  teleport ${PLAYER} → startPos
  waitFor player_auth_input × 2         (user spec — minimal warm-up)
  <run actions>                         (the scenario)
  waitFor player_auth_input × 5         (final settle)
```

**Key safe-zone behavior:** `sceneAnchor` is the position the player stood
during `shared_world_setup` for that scene (use `sceneAnchor(SCENES.<name>)`
from `scene_positions.ts` to get it). The preamble teleports to
`(anchor.x, anchor.y + 32, anchor.z)` so chunks within render distance of
the actual scene are loaded before the recorded window opens. Every scene
gets its own safe-zone — no single global point is reused.

| Field | Purpose | Default |
|---|---|---|
| `name` | testCase name (lands in fixture filename) | required |
| `description` | Stamped into testCaseStart L-record | — |
| `setupDescription` | Body of the `SETUP:` note L-record | falls back to `description` |
| `startPos` | Where the player stands when `run` opens | required |
| `yaw` / `pitch` | Orientation at startPos | 0 / 0 |
| `sceneAnchor` | Per-scene world-prep position (chunk warm-up target) | — (falls back to column above `startPos`) |
| `safeZone` | Explicit safe-zone tp position | derived from sceneAnchor |
| `safeZoneYOffset` | Y-offset added above `sceneAnchor`/`startPos` | 32 |
| `setup` | Setup callback (inside fixture window) | — |
| `setupSettleTicks` | PAI ticks after setup commands fire | 4 |
| `run` | Scenario actions | required |
| `preActionTicks` | PAI ticks between final teleport and `run` | 2 |
| `postActionTicks` | PAI ticks at end of testCase | 5 |
| `clearEffects` / `giveResistance` / `clearInventory` | Preamble cleanup steps | true |
| `waitForChunks` | Whether preamble waits for chunk silence | true |
| `preambleSettleTicks` | PAI ticks after safe-zone teleport | 8 |

### `resetAndTeleport` — lower-level setup helper

```ts
.resetAndTeleport({
  startPos:        { x: 0, y: 64, z: 0 },
  yaw:             90,
  pitch:           0,
  clearEffects:    true,   // default
  giveResistance:  true,   // default — prevents fall damage during the teleport
  clearInventory:  true,   // default
  waitForChunks:   true,   // default — 10s ceiling
  waitForTeleport: true,   // default — waits 8 PAI ticks (deterministic)
  settleTicks:     5,      // default — final PAI count before opening the test case
})
```

Wraps the above in a `preamble()` block so none of it lands inside the
fixture's PAI window.

## Automatic per-case setup with `Fixture.beforeEachCase`

For fixtures where every test case wants the same setup, set
`beforeEachCase` on the `Fixture` rather than calling `resetAndTeleport`
inside every factory:

```ts
registerFixture({
  name: 'my_fixture',
  description: '...',
  beforeEachCase: ({ name, options }) =>
    new SimulationBuilder().resetAndTeleport({
      startPos: options?.startPos ?? { x: 0, y: 64, z: 0 },
    }),
  sequences: [
    new SimulationBuilder()
      .testCase('case_a', (b) => b.keyDown('w').waitFor('player_auth_input', 20).keyUp('w'), { startPos: { x: 0, y: 64, z: 0 } })
      .testCase('case_b', (b) => b.keyDown('s').waitFor('player_auth_input', 20).keyUp('s'), { startPos: { x: 0, y: 64, z: 100 } })
      .build(),
  ],
});
```

`runFixture()` transforms the action stream: before every `testCaseStart`,
it injects the hook's returned actions wrapped in a `preamble()`. Return
`null` from the hook to skip injection for a specific case.

## JSON parametric overlays

For matrix sweeps (yaw × pitch × ticks etc.), declare a single primitive
and let the overlay expander stamp out N cases:

```jsonc
// packages/scenarios/src/overlays/walk_yaw_pitch_sweep.overlay.json
{
  "name":      "walk_yaw_pitch_sweep",
  "description": "Walk forward at every 45° yaw step.",
  "primitive": "walk",
  "matrix": {
    "yaw":   { "kind": "range", "from": 0, "to": 315, "step": 45 },
    "pitch": { "kind": "list",  "values": [-30, 0, 15, 45] }
  },
  "skip": [{ "yaw": 180, "pitch": 0 }]
}
```

`walk` is a primitive in `packages/scenarios/src/primitives/index.ts`. The
expander takes the cartesian product of the matrix (8 yaws × 4 pitches =
32 cases minus 1 skip = 31), wraps each in `testCase`, and produces a
single `SimulationSequence`. Run with:

```pwsh
bdt record --overlay packages/scenarios/src/overlays/walk_yaw_pitch_sweep.overlay.json `
           --client 1.26.13.1 --legacy
```

`MatrixDim` kinds: `range` (inclusive `from..to` by `step`), `list` (explicit
array), `const` (single value). See `packages/scenarios/src/overlay/schema.ts`.

## Scene positions

`packages/scenarios/src/fixtures/scene_positions.ts` has the 30 scene
constants used by the build-once world (`shared_world_setup`). Each entry
is `{ x, z, viewZ }` — `viewZ` is the offset from the scene center where
the player stands looking IN to the scene.

```ts
import { SCENES, preloadScene } from './scene_positions.js';

const flat = SCENES.flat;                                       // { x: 0, z: 0, viewZ: -31 }
const teleportTarget = { x: flat.x, y: 0, z: flat.z + flat.viewZ };
```

`preloadScene(SCENES.<name>)` returns a pre-built sequence that teleports
in, waits for chunks, applies a resistance effect. Use as the first
sequence in a fixture that pins itself to one scene.

## Porting from v2

The mechanical checklist (also in `packages/scenarios/src/fixtures/index.ts`):

1. Copy `bedrock-tools-v2/packages/recorder/src/fixtures2/<name>.ts` →
   `packages/scenarios/src/fixtures/<name>.ts`.
2. Update imports:
   - `"../simulation-builder.ts"` → `"../builder.js"`
   - `"../fixtures/fixture.ts"` → `"@bdt/core"`
   - `"./scene_positions.ts"` → `"./scene_positions.js"`
3. Delete the `wait` import from `old.ts` and any reference to it.
4. Find-replace `@a` → `${PLAYER}` in command strings (keep `@a` only when
   you genuinely target every connected player).
5. Wrap the exported `get_*_fixture_v2()` in `registerFixture()` at module
   scope so the barrel import registers it.
6. Add `import './<name>.js';` to `packages/scenarios/src/fixtures/index.ts`.
7. `npm run build`; `bdt list-fixtures` should now show your fixture.

## Testing without a live client

`@bdt/scenarios` has no native dep. You can unit-test a sequence with a
mock executor context:

```ts
import { EventEmitter } from 'node:events';
import { SimulationBuilder, executeSequence } from '@bdt/scenarios';

const events = new EventEmitter();
const logs: unknown[] = [];
const queued: unknown[] = [];

const seq = new SimulationBuilder()
  .command('say hi')
  .waitFor('player_auth_input', 2)
  .build();

const done = executeSequence(seq.actions, {
  events,
  player: { upstream: { queue: (n, p) => queued.push({ n, p }) }, on() {}, off() {}, removeListener() {} },
  writer: { writeLog: (r) => logs.push(r), writeNote: () => {} },
  input: { /* mock InputControllerLike */ },
  vars: { PLAYER: '@s' },
});

events.emit('player_auth_input');
events.emit('player_auth_input');
await done;
// queued = [{ n: 'command_request', p: { command: 'say hi', ... } }]
```

See `packages/scenarios/src/executor.test.ts` for the full pattern.
