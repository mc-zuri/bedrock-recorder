# Deterministic world recordings

Physics fixtures depend on **deterministic block geometry**. If the BDS world
changes between recordings (player breaks a block, mob spawns drop loot, day
turns to night and a phantom dies somewhere), the fixture diffs become noise.

`bedrock-tools-v5` solves this with a build-once / replay-many pipeline:

```
                     one-time bootstrap                  every recording
┌──────────────────────────────────────────────┐ ┌────────────────────────────┐
│ 1. bdt record --fixture shared_world_setup   │ │ 4. bdt record --fixture X  │
│      → BDS materializes all 28 scenes via    │ │      → launchBds() copies  │
│        fill/setblock commands.               │ │        template world dir  │
│ 2. bdt snapshot-world                        │ │        into BDS before     │
│      → copy BDS world dir → template path    │ │        starting the server│
│ 3. (optional) bdt record --fixture           │ │ 5. Recording is reproducible│
│        shared_world_visit                     │ │      across runs.          │
│      → teleports through every scene to       │ │                            │
│        verify the snapshot has the geometry.  │ │                            │
└──────────────────────────────────────────────┘ └────────────────────────────┘
```

## Step 1 — build the world

```pwsh
bdt record --fixture shared_world_setup --client 1.26.13.1 --legacy
```

This fixture has one sequence per scene (28 in total). Each sequence:

1. Teleports the player to the scene's viewing position
2. Emits `fill`/`setblock` commands for the scene's blocks (e.g. water pool
   walls + water fill, stair pyramid, ladder wall, scaffolding tower …)
3. Waits ~80 PAI ticks so BDS persists the chunks to disk

Runtime: ~5–8 minutes. Output: a `.proxy.bin` you can discard — the value is
in BDS's world dir which now contains all 28 scenes.

## Step 2 — snapshot the world

```pwsh
bdt snapshot-world --client 1.26.13.1
```

Copies `<bdsPaths.base>/bds-<version>/worlds/<worldName>` →
`versionConfig.templateWorldPath` (from your `bdt.config.json`).

The default destination is the path already configured in your version block:

```jsonc
"1.26.13.1": {
  "templateWorldPath": "D:/node-bedrock-client-demo/worlds/state-machine-farmer",
  ...
}
```

Pass `--out <path>` to write somewhere else, `--force` to overwrite an
existing destination, `--from <path>` to snapshot a different source.

## Step 3 — verify (optional)

```pwsh
bdt record --fixture shared_world_visit --client 1.26.13.1 --legacy
```

Teleports the player through every scene without issuing any build commands.
If chunks load and the world looks right, your template is good.

## Step 4 — record any fixture, reproducibly

```pwsh
bdt record --fixture v2_ground_movement --client 1.26.13.1 --legacy
```

`launchBds()` (`packages/bds-adapter/src/bds-launcher.ts`) sees
`templateWorldPath` is set, deletes the existing BDS world dir, and copies
the template in fresh. Every recording starts from the same block layout.

## Per-scenario block resets

For fixtures where the test case *modifies* blocks (mining, placing,
exploding), you can opt into automatic between-case resets via
`Fixture.beforeEachCase` — emit `/fill` commands to restore the affected
region:

```ts
beforeEachCase: ({ name, options }) =>
  new SimulationBuilder()
    .resetAndTeleport({
      startPos: options?.startPos ?? { x: 0, y: 0, z: 0 },
    })
    .command('fill ~-10 ~-1 ~-10 ~10 ~5 ~10 air destroy')   // clear the work area
    .command('fill ~-10 ~-1 ~-10 ~10 ~-1 ~10 stone')         // re-floor it
    .waitFor('player_auth_input', 5),
```

The preamble's L-records (`preamble-start` / `preamble-end`) sit *outside*
the test-case window, so the extractor's per-case PAI extraction ignores
those PAI ticks. Only post-reset, in-window movement makes it into the
generated fixture.

## When to rebuild the template

- Adding / changing a scene in `packages/scenarios/src/fixtures/shared_world.ts`
- Bumping `bdsVersion` in your config (BDS upgrades sometimes regenerate
  the seed-based base terrain — the build-once output gives you a stable
  superflat layer on top)
- After any manual edit you made in-game (use `--force` on snapshot-world
  to capture the new state)
