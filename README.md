# bedrock-tools-v5

**Minecraft Bedrock client automation + packet recorder.** Drives a real
Minecraft Bedrock client through scripted scenarios (walk, jump, swim,
glide, etc.), captures every packet exchanged with a Bedrock Dedicated
Server (BDS), and writes a deterministic `.proxy.bin` dump per recording.

The dumps are the input to downstream physics-fixture pipelines used to
test Minecraft physics engines against bit-exact recordings of real client
behaviour.

---

## How to record (5 steps)

### 1. One-time setup

```pwsh
git clone https://github.com/mc-zuri/bedrock-recorder
cd bedrock-recorder
npm install      # also builds the C++ native addon (~30 s clean)
npm run build    # compiles all TS packages
```

### 2. Configure

```pwsh
Copy-Item bdt.config.example.json bdt.config.json
```

Edit **`bdt.config.json`** and set `relay.username` to your Minecraft
gamertag. Everything else (BDS download dir, profiles folder, dump dir)
has sensible defaults under `./bds/`, `./profiles/`, `./dumps/`.

### 3. Build the shared world template *(one-time, ~2 min)*

A flat starter world with beta-API experiments enabled is bundled at
[`worlds/beta_flat_1.26.0/`](worlds/) — the example config points
`templateWorldPath` at it. Beta API is required for some setup
`scriptevent` commands (Soul Speed boots, etc.).

Now build the 29 scenes (stairs, water/lava pools, ladders, etc.) on top
of the flat base by recording the setup fixture, then snapshot the
result as your working template:

```pwsh
node packages/cli/dist/cli.js record --fixture shared_world_setup --client 1.26.13.1
```
Launch Minecraft → *Servers* → *Add Server* → `127.0.0.1:19150` → Connect.
Wait for the recorder to print `done.`, then:

```pwsh
node packages/cli/dist/cli.js snapshot-world --client 1.26.13.1 --force
```

`snapshot-world` copies the resulting BDS world back into the template
dir, so every subsequent recording starts from the **fully-built**
scenes world instead of the flat base.

### 4. Record a fixture

Pick a fixture name (see [Fixtures](#fixtures) below), then:

```pwsh
node packages/cli/dist/cli.js record `
  --fixture v2_ground_movement `
  --client 1.26.13.1 `
  --out ./dumps/test
```

You'll see:

```
[bdt] launching BDS …
[bdt] recording → ./dumps/test/1.26.13.1-v2_ground_movement.proxy.bin
[bdt] waiting for client on 0.0.0.0:19150 …
[bdt]    (in Minecraft: Servers → Add Server → 127.0.0.1:19150)
```

**Connect from Minecraft now** — same address as step 3. The recorder
detects the connection, ops the player, runs the scenarios, prints
`done.`, and exits 0.

### 5. *(optional)* Use the `just` shortcut

For the **default fixture** (`v2_all`, ~90 min), with no flags to
remember:

```pwsh
just record                              # → ./dumps/1.26.13.1/1.26.13.1-v2_all.proxy.bin
just record 1.26.4.1                     # different client version
just record 1.26.13.1 D:/some/other/dir  # different output dir
```

---

## How to generate fixtures from a recording

The recorder writes a `.proxy.bin`; the **extract pipeline** turns it
into the artefacts a downstream physics-engine test suite consumes.

The pipeline shells out to three external tools (see *Related projects*).
Set them up as sibling clones of this repo, **or** override the paths via
env vars (see `justfile` header).

```
sibling/
├── bedrock-recorder/                    ← you are here
├── bedrock-tools-v2/                    ← provides extract-physics-fixtures.ts
├── bedrock-oracle/tools/analyze-bin/    ← provides per-scenario world export
├── tools/merge-worlds/                  ← merges per-scenario worlds → one file
└── mineflayer-physics-utils/            ← consumer repo (test target)
```

### Generate everything in one command

```pwsh
just fixtures                                # uses default ./dumps/1.26.13.1/
just fixtures 1.26.4.1                       # different version
just fixtures 1.26.13.1 D:/some/other/dir    # different dump location
```

This runs four steps against `<dumpDir>/<version>-v2_all.proxy.bin`:

| # | Step | Output |
|---|---|---|
| 1 | `extract-physics-fixtures.ts` | `<mfpu>/tests/unit/bedrock/scenarios/<scenario>.test.js` (mocha files with per-tick PAI diffs) |
| 2a | `analyze-bin/main.ts` | `<mfpu>/tests/fixtures/bedrock/worlds/<scenario>.json` (per-scenario block geometry) |
| 2b | `merge-worlds.js` | `<mfpu>/tests/fixtures/bedrock/world.json` (single merged + cuboid-packed world) |
| 3 | `dump-scenarios-yaml.ts` | `<mfpu>/tests/unit/bedrock/scenarios/<scenario>.yml` (the input scenario, sibling to its `.test.js`) |

### Run the consumer tests

```pwsh
cd ../mineflayer-physics-utils
pnpm run test:scenarios
```

---

## Fixtures

```
smoke                        — stand still for ~30 PAI ticks (sanity check)
shared_world_setup           — build all 29 scenes (one-time bootstrap)
shared_world_visit           — teleport through every scene (template verify)

# Per-system fixtures (each runnable individually)
v2_core_coverage             — one representative case per physics system
v2_ground_movement           — walk/sprint/sneak/strafe matrix (~120 cases)
v2_jump_mechanics            — normal/sprint/sneak/strafe jumps + jump boost
v2_air_movement              — free fall, fall-with-input, air control, momentum
v2_honey_slime               — walk/sprint/jump/bounce on honey + slime
v2_water_physics             — submerged, surface, entry/exit, depth strider
v2_lava_physics              — submerged, surface, entry/exit, transitions
v2_elytra                    — gliding from height, yaw/pitch sweep, firework boost
v2_teleportation             — mid-motion teleports, rapid chains
v2_v11_coverage              — Soul Speed, Armor Fly, Freeze Immune, Item Use
walk_ground_to_water         — walk into half-pool, yaw=19, pitch sweep
sprint_ground_to_water       — sprint into half-pool, yaw=-14, pitch sweep
prismarine_physics           — focused per-primitive regression suite
v2_extras                    — creative fly, tunnels, jump-into-wall, slides

# Composite bundles
v2_prismarine_physics_bundle — prismarine_physics + ground_movement + elytra
v2_full_coverage_bundle      — 12 fixtures combined
v2_all                       — every fixture above, one big run (~90 min)
```

Run `node packages/cli/dist/cli.js list-fixtures` for the live registry.

---

## CLI reference

```
bdt record  [--fixture <name>... | --overlay <path>...]
            [--client <ver>] [--out <dir>] [--legacy] [--keep-server]
bdt list-fixtures   [--filter <substring>]
bdt list-overlays   [--filter <substring>]
bdt config          show | init
bdt snapshot-world  [--client <ver>] [--force]
```

Flags:

- `--fixture <name>` — repeatable; runs each fixture in sequence into its own `.proxy.bin`.
- `--overlay <path>` — JSON parametric overlay; expands into multiple cases at runtime.
- `--client <ver>` — key in `bdt.config.json#versions`. Defaults to `defaultVersion`.
- `--out <dir>` — where to write the `.proxy.bin`. Defaults to `dumpDir` from config.
- `--legacy` — omit the BDT5 header so the file is byte-identical to the v2 format. Use this if your downstream tooling can't read the v5 header.
- `--keep-server` — leave BDS running after the recording finishes (useful for inspection).

Full reference: [`docs/CLI.md`](docs/CLI.md).

---

## Prerequisites

- **Windows 10/11** — input injection uses Win32 `SendInput`.
- **Node.js 22+**, **Visual Studio Build Tools**, **Python** (for `node-gyp`).
- **Minecraft for Windows (Bedrock Edition)** — launch manually; the
  recorder waits for you to connect from the *Servers* tab.
- **BDS** itself is auto-downloaded via `minecraft-bedrock-server` on first
  run; no manual install.

Optional: [`just`](https://github.com/casey/just) for the shorthand
`just record` / `just fixtures` recipes.

---

## What's in the box

```
packages/
  native-input/   C++ N-API addon: Win32 SendInput + foreground-window filter
                  + typed InputController. Input-only — capture/vision is
                  deferred.
  bdt-core/       Shared types. Zero runtime deps.
  scenarios/      SimulationBuilder DSL + primitive registry + JSON
                  parametric-overlay expander + the ported fixture set.
  bds-adapter/    bedrock-protocol Relay + BDS lifecycle +
                  PacketDumpWriter/Reader + config.
  cli/            The `bdt` binary (commander-based).
scripts/dev/      Diagnostic utilities (inspect-pai, scan-chunk-names, …).
docs/             ARCHITECTURE / CLI / CONFIG / FIXTURE_AUTHORING /
                  WORLD_TEMPLATE / SMOKE_TEST / TROUBLESHOOTING / ROADMAP.
```

---

## Documentation

| Doc | Read when… |
|---|---|
| [ARCHITECTURE](docs/ARCHITECTURE.md)         | Onboarding — package layout, data flow, key design decisions |
| [CLI](docs/CLI.md)                           | You need to invoke `bdt <command>` and want every flag |
| [CONFIG](docs/CONFIG.md)                     | Editing `bdt.config.json`; field-by-field reference |
| [FIXTURE_AUTHORING](docs/FIXTURE_AUTHORING.md) | Writing a new fixture, porting from v2 |
| [WORLD_TEMPLATE](docs/WORLD_TEMPLATE.md)     | Building the shared scenes world; deterministic recordings |
| [SMOKE_TEST](docs/SMOKE_TEST.md)             | First-time manual verification |
| [TROUBLESHOOTING](docs/TROUBLESHOOTING.md)   | Things hang / fail / produce nothing |
| [ROADMAP](docs/ROADMAP.md)                   | What's shipped, what's next |

---

## Verify it works without a live client

```pwsh
npm test    # ~55 unit tests across native-input / scenarios / bds-adapter
```

---

## Related projects

The recorder writes dumps; downstream pipelines consume them. None of
these are required to use the recorder itself, but they're useful for
the extract pipeline above.

- **prismarine-bedrock** — physics engine; its tests are seeded from these dumps.
- **mineflayer-physics-utils** — Node-side physics engine in the same family.
- **bedrock-tools-v2** — predecessor; its `extract-physics-fixtures.ts`
  script turns `.proxy.bin` into mocha test files. v5 is wire-compatible.

---

## License

[MIT](LICENSE)
