# CLI reference

`bdt` is the single entry point. After `npm run build`, the binary lives at
`packages/cli/dist/cli.js`. Invoke as `node packages/cli/dist/cli.js <command>`
or, if you `npm link` the workspace, just `bdt <command>`.

## Global

```
bdt --help
bdt --version    # prints the @bdt/cli package version
```

## `bdt record`

Run one or more fixtures (or expand an overlay JSON), record every packet to
a `.proxy.bin`.

```
bdt record  [--fixture <name>...]
            [--overlay <path>...]
            [--client <version>]
            [--out <dir>]
            [--config <path>]
            [--no-bds-autodownload]
            [--keep-server]
            [--legacy]
```

| Flag | Purpose |
|---|---|
| `--fixture <name>...` | Fixture(s) to record (from the registry — see `bdt list-fixtures`). Can be repeated. |
| `--overlay <path>...` | `*.overlay.json` file(s) to expand and record. Can be repeated. |
| `--client <ver>` | Client version key from `bdt.config.json#versions`. Default: `defaultVersion`. |
| `--out <dir>` | Output dir for `.proxy.bin`. Default: `config.dumpDir`. |
| `--config <path>` | Explicit `bdt.config.json` path. Default: walk up from cwd. |
| `--no-bds-autodownload` | Skip BDS auto-download (assume it's installed at `bdsPaths.base/bds-<bdsVersion>`). |
| `--keep-server` | Leave BDS running after recording. Useful for back-to-back debug. |
| `--legacy` | Omit the BDT5 header so the file is byte-compatible with v2's `extract-physics-fixtures.ts`. Drop this once the extractor is patched for v5 headers. |

**Examples**

```pwsh
# Single fixture, auto-everything
bdt record --fixture smoke --client 1.26.13.1 --legacy

# Two fixtures, custom output dir
bdt record --fixture v2_ground_movement --fixture v2_water_physics `
           --client 1.26.13.1 --out ./dumps/1.26.13.1 --legacy

# Overlay sweep (e.g. walk × yaw × pitch matrix)
bdt record --overlay packages/scenarios/src/overlays/walk_yaw_pitch_sweep.overlay.json `
           --client 1.26.13.1 --legacy
```

## `bdt list-fixtures`

Print the registry. Useful before `--fixture <name>`.

```
bdt list-fixtures [--filter <substring>]
```

| Flag | Purpose |
|---|---|
| `--filter <s>` | Only show names containing `<s>`. |

```pwsh
bdt list-fixtures
# →
#   smoke — Minimal sanity check: reset → teleport → stand still 30 ticks.
#   shared_world_setup
#   shared_world_visit
#   v2_ground_movement
```

## `bdt list-overlays`

Discover `*.overlay.json` files.

```
bdt list-overlays [--dir <path>] [--filter <substring>]
```

Default `--dir` is `packages/scenarios/src/overlays`.

## `bdt config`

Inspect or scaffold `bdt.config.json`.

```
bdt config show     # prints the loaded merged config (with discovered path)
bdt config init     # copies bdt.config.example.json → ./bdt.config.json
```

## `bdt snapshot-world`

Copy BDS's world dir to a reusable template path (see `WORLD_TEMPLATE.md`).

```
bdt snapshot-world  [--client <version>]
                    [--from <path>]
                    [--out <path>]
                    [--force]
                    [--config <path>]
```

| Flag | Purpose |
|---|---|
| `--client <ver>` | Version key (defaults to `config.defaultVersion`). |
| `--from <path>` | Source dir. Default: `{bdsPaths.base}/bds-{bdsVersion}/worlds/{worldName}`. |
| `--out <path>` | Destination template. Default: `versionConfig.templateWorldPath`. |
| `--force` | Overwrite the destination if it already exists. |

```pwsh
# Standard build-once / replay-many bootstrap
bdt record --fixture shared_world_setup --client 1.26.13.1 --legacy
bdt snapshot-world --client 1.26.13.1 --force
```

## `bdt extract` *(planned)*

A future thin wrapper around `prismarine-bedrock/scripts/extract-physics-fixtures.ts`.
Currently you call the v2 script directly:

```pwsh
cd <bedrock-tools-v2>/packages/recorder
npx tsx scripts/extract-physics-fixtures.ts `
    <bedrock-tools-v5>/dumps/1.26.13.1/1.26.13.1-v2_ground_movement.proxy.bin `
    <prismarine-bedrock>/test/static/physics `
    26.10
```

Note the third arg: v2's `minecraft-data` uses old-style protocol names
(`26.10`, not `1.26.10`).

## Environment variables

| Var | Effect |
|---|---|
| `BDT_DEBUG` | Print the JS stack trace on top-level errors (otherwise only the message). |
