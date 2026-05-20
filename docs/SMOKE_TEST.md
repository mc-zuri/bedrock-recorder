# Phase 1 end-to-end smoke test

The recorder needs a real Minecraft for Windows client to drive — that part
is manual. This document is the exact sequence for verifying v5 works against
the existing prismarine-bedrock fixture pipeline.

## Prerequisites

- Windows 10/11
- Node 22+ (`node --version`)
- Visual Studio Build Tools (already installed if `npm run build` succeeded once)
- Minecraft for Windows (Bedrock Edition), launched **manually** before the recording
- A `bdt.config.json` next to the v5 checkout. Start from the example:
  ```pwsh
  Copy-Item bdt.config.example.json bdt.config.json
  ```

## Confirm everything is wired

```pwsh
cd <bedrock-tools-v5>
npm run build      # native addon + 5 TS packages
npm test           # 44+ tests across native-input, scenarios, bds-adapter
node packages/cli/dist/cli.js list-fixtures
# expected:
#   smoke — Minimal sanity check fixture: stand still for ~30 ticks.
#   v2_ground_movement
```

## Run the smoke fixture

The smoke fixture stands still for ~30 ticks, producing a tiny but valid
`.proxy.bin`.

In one terminal:
```pwsh
node packages/cli/dist/cli.js record `
  --fixture smoke `
  --client 1.26.13.1 `
  --out ./dumps/1.26.13.1 `
  --legacy
```

The `--legacy` flag omits the new BDT5 header so the file is byte-compatible
with `extract-physics-fixtures.ts`. Drop it once the extractor is patched to
read the v5 header (see *Header upgrade path* below).

You should see:
```
[bdt] loaded config from <bedrock-tools-v5>\bdt.config.json
[bdt] client version: 1.26.13.1 (protocol 26.10, BDS 1.26.14.1)
[bdt] launching BDS …
... BDS startup logs ...
[bdt] recording → ./dumps/1.26.13.1/1.26.13.1-smoke.proxy.bin (legacy/v2 wire format)
[bdt] waiting for client on 0.0.0.0:19150 …
[bdt]    (in Minecraft: Servers → Add Server → 127.0.0.1:19150)
```

In Minecraft:
1. Servers → Add Server (or Direct Connect)
2. Server address: `127.0.0.1`, Port: `19150`
3. Connect

The recorder then:
1. Detects the connection
2. Runs `op <username>` via BDS stdin
3. Waits 5s for the op to settle
4. Drives the smoke sequence (no input — just waits)
5. Closes the relay
6. Stops BDS

Expected final output:
```
[bdt] client connected; opping and giving it 5s to settle.
[bdt] sequence 1/1
▶ stand_still
✓ stand_still
[bdt] fixture complete; closing relay.
[bdt] stopping BDS …
[bdt] done.
```

## Verify the dump against the prismarine-bedrock extractor

```pwsh
cd <bedrock-tools-v2>\packages\recorder
npx tsx scripts\extract-physics-fixtures.ts `
  <bedrock-tools-v5>\dumps\1.26.13.1\1.26.13.1-smoke.proxy.bin `
  <prismarine-bedrock>\test\static\physics
```

The smoke fixture only has one test case (`stand_still`) and no movement, so
the extractor may filter it out (it requires ≥3 PAI frames per case and a
non-preload window). That's fine — the existence of L-records bracketing the
test case and the S/C packet stream is what matters at this stage.

For a richer test that produces meaningful physics fixtures, use the ported
ground-movement fixture:
```pwsh
node packages/cli/dist/cli.js record `
  --fixture v2_ground_movement `
  --client 1.26.13.1 `
  --out ./dumps/1.26.13.1 `
  --legacy
```

This runs all 120+ ground-movement test cases, producing a multi-MB
`.proxy.bin` that the extractor turns into ~120 `.test.js` files under
`test/static/physics/`.

## Header upgrade path

Today: `--legacy` omits the BDT5 header so existing tooling reads the file
unchanged.

To switch to the richer v5 header (magic + schemaVersion + epochNanos):
1. Patch `<bedrock-tools-v2>\packages\recorder\scripts\extract-physics-fixtures.ts`
   to probe for `BDT5\x00` at offset 0 and, if present, skip the 17-byte
   header before reading the version string. v5's
   `PacketDumpReader.open()` already does this — copy the probe logic from
   `packages/bds-adapter/src/dump-reader.ts:38-54`.
2. Drop `--legacy` from the CLI invocation.
3. (Optional) Upstream the patch to prismarine-bedrock.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Recorder hangs at "waiting for client …" | Client not connected to relay; or Minecraft is not the foreground window | Click into the Minecraft window; check the server address is `127.0.0.1:19150` |
| `Unsupported client version` error at startup | `protocolVersion` in config not in installed bedrock-protocol | Check `node_modules/bedrock-protocol/data/versions.json`; update `protocolVersion` or pin a different bedrock-protocol release |
| BDS doesn't start | Path mismatch / missing executable | Run with `BDT_DEBUG=1` and inspect the spawn args; verify `bdsPaths.base` in config |
| Inputs not getting through to Minecraft | Foreground filter mismatch | Confirm the window title contains "Minecraft"; use `InputController.setForegroundFilter(null)` to disable the gate while debugging |
| `[bdt] secondary client connection ignored` | Multiple clients hitting the relay | Single-client by design; close the extra connection |

## What this smoke test proves

- ✅ Native input addon loads and the `${PLAYER}` substitution works
- ✅ Config-driven version selection works
- ✅ BDS auto-download + spawn works
- ✅ `bedrock-protocol` Relay accepts the client
- ✅ Serverbound/clientbound packets flow into the dump writer
- ✅ Per-test-case L-records are emitted
- ✅ The dump is byte-compatible with the existing prismarine-bedrock extractor

What it doesn't (yet):
- The full 7,000+ lines of v2 fixtures are not all ported — only
  `01_ground_movement` is. The remaining ports are mechanical; see the
  checklist in `packages/scenarios/src/fixtures/index.ts`.
- The BDT5 header isn't yet read by the upstream extractor; for now use `--legacy`.
- UI detection / vision (slot clicks) is Phase 2.
