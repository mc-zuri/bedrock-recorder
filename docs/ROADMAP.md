# Roadmap

What's shipped, what's in progress, what's open.

## Phase 1 — MVP, v2 parity   *(done)*

The recorder loop runs end-to-end without manual interaction, produces a
`.proxy.bin` byte-compatible with the existing prismarine-bedrock pipeline.

| Area | Status | Notes |
|---|---|---|
| 5-package monorepo | ✅ | `@bdt/{core,native-input,scenarios,bds-adapter,cli}` |
| C++ N-API native input | ✅ | `SendInput` + foreground filter + typed `InputController` |
| `bedrock-protocol` Relay bridge | ✅ | Username/profilesFolder config-driven |
| BDS lifecycle | ✅ | Auto-download + spawn + stop + stdin commands |
| `PacketDumpWriter` + `PacketDumpReader` | ✅ | BDT5 magic + schemaVersion + epochNs header; `--legacy` strips it for v2 compat |
| `SimulationBuilder` DSL | ✅ | All v2 methods + `preamble()` + `resetAndTeleport()` + `description` |
| Executor | ✅ | for-of-await; AbortSignal; per-wait 15s timeout; hooks |
| `${PLAYER}` substitution | ✅ | Resolves to `@s`; recordings portable across logins |
| JSON parametric overlays | ✅ | range/list/const matrix dims; skip table; cartesian expand |
| CLI | ✅ | `record` / `list-fixtures` / `list-overlays` / `config show\|init` / `snapshot-world` |
| Disconnect-aborts-fixture | ✅ | Cleanup runs when client closes |
| Build-once template world | ✅ | `shared_world_setup` (29 scenes) + `snapshot-world` |
| Per-case `beforeEachCase` hook | ✅ | Auto-injected preamble before each `testCaseStart` |
| 55 unit tests | ✅ | native-input (5) + scenarios (32) + bds-adapter (18) |
| End-to-end smoke verified | ✅ | smoke → `.proxy.bin` → extract-physics-fixtures.ts → `stand_still.test.js` ✓ |
| v2_ground_movement at scale | ✅ | 76 test cases, 2.49 MB dump, clean cleanup |

## Phase 1 — known limitations (intentional, not blockers)

| Item | Current state | Workaround |
|---|---|---|
| Extractor reads v2 wire format | True for now | Pass `--legacy` on `bdt record`. Upgrade the prismarine-bedrock extractor to skip the BDT5 header to remove this. |
| Foreground-window gate on `SendInput` | Hard requirement of Win32 input injection | Either keep Minecraft focused, or call `InputController.setForegroundFilter(null)` to disable. |
| `waitUntilTeleportHandled` predicate | Not reliable for setup-time use (handshake fires before listener attaches) | `resetAndTeleport` uses deterministic `waitFor('player_auth_input', 8)` instead. The predicate remains for *in-test-case* movement waits. |
| 14 fixtures ported from v2 (`v2_ground_movement` + 11 from main.ts L213-244 + 2 `*_ground_to_water`) + 2 composite bundles | All v2 main.ts fixtures ported | Each test case uses the new `sceneTestCase()` helper so effect/item setup packets land *inside* the recorded window. |

## Phase 1 — open / nice to have

| Item | Priority | Notes |
|---|---|---|
| ~~Port remaining v2 fixtures~~ | done | All v2 `main.ts` L213-244 fixtures ported; per-case `sceneTestCase()` setup makes effect/item packets visible in the fixture window. |
| Re-record `v2_ground_movement` post-template-snapshot | low | Once-per-protocol-bump regression check. |
| `bdt extract` wrapper command | low | Currently you run `npx tsx <path-to-v2-extractor>`; consolidating into `bdt extract <dump> [--out <dir>]` would close the loop. |
| Upstream the BDT5 header probe to `prismarine-bedrock` | low | Removes `--legacy` flag. |

## Phase 2 — Vision + UI automation

Goal: drive container interactions (open chest, take item, place item) so
the recorder can produce fixtures for inventory/transaction packets.

| Item | Notes |
|---|---|
| `@bdt/vision` package | New package; depends on `@bdt/native-input` for capture. |
| Screen capture | DXGI Desktop Duplication or `BitBlt` of the Minecraft window. Native C++ in `native-input/src/capture.cpp` (additive — keeps the single-addon design). |
| Window-finding + client-rect translation | `FindWindow` / `GetClientRect` / `ClientToScreen` in `native-input/src/window.cpp`. Maps slot pixels → absolute screen coords for `mouseMove`. |
| Template matching | OpenCV via `opencv4nodejs` or a slim native binding. ROI-based UI state detection (pause menu, inventory, hotbar). |
| `clickSlot(index)` primitive | Bridge: vision finds slot → mouseMove + click. |
| Container fixture | Port v2's `25_container.ts` — chests, furnaces, smithing tables. |

## Phase 3 — Direct fixture emission + replay

Skip the `.proxy.bin` intermediate for fast iteration.

| Item | Notes |
|---|---|
| `@bdt/extractor` vendored | Pull `extract-physics-fixtures.ts` into the monorepo. |
| `bdt record --emit-fixtures <path>` | `DumpSink.tap()` listener subscribes the extractor in-process; PAI streams to the fixture writer directly. |
| `@bdt/replayer` | Reads `.proxy.bin`, replays into a fresh BDS. Enables protocol-version migration testing. |

## Phase 5 — Cross-version regression + CI

| Item | Notes |
|---|---|
| Versioned fixture matrix | All overlays × all configured client versions, diff outputs. |
| GitHub Actions Windows runner | Install BDS via `autoDownload`, run smoke, upload `.proxy.bin` artifact. Bedrock client upgrades auto-record + diff PR to prismarine-bedrock. |

## Removed scope

| Item | Why dropped |
|---|---|
| Hybrid C#/.NET architecture | The v4 PoC validated it but Node + N-API was chosen for v5. |
| Endstone server support | v2 had a silent Endstone override; v5 dropped it. Vanilla BDS only (auto-downloaded). |
| Auto-launch + DLL injection | v2 shelled out to `just inject-to` (v26-tracer). v5 is self-contained — launch Minecraft manually. |
| `op <hardcoded-username>` | v2 hardcoded a personal gamertag. v5 uses `op @a` post-spawn so any login works. |
