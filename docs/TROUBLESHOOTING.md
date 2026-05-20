# Troubleshooting

Common failure modes and fixes, in roughly the order they surface as you
add new scenarios.

## Setup / launch

### `Unsupported version <X>` from bedrock-protocol

The relay's `version` option must be a key in `node_modules/bedrock-protocol/src/options.js#Versions` (which maps Minecraft version strings → numeric protocol IDs).

```
config.versions.1.26.13.1.protocolVersion: "1.26.10"   // ✓ valid key
config.versions.1.26.13.1.protocolVersion: "26.10"     // ✗ that's the protocol number
config.versions.1.26.13.1.protocolVersion: "1.26.13.1" // ✗ no entry that specific
```

Pick the largest key in `Versions` that's `<=` your actual client version.
`bdt record` calls `assertSupported()` at startup and surfaces this with the
full list of valid keys.

### `Server did not start within 60000ms`

BDS's stdout never produced `Server started` or `IPv4 supported`. Run with
the BDS process visible (not headless) and check:

- World file corrupted? Try deleting `<bdsPaths.base>/bds-<ver>/worlds/<worldName>/`
  and rerunning — the template is copied fresh.
- Port collision? Another BDS still running. `netstat -ano | grep 19190`.
- Wrong `bdsVersion`? `<bdsPaths.base>/bds-<bdsVersion>/bedrock_server.exe` must
  exist; auto-download is gated on this being missing.

### Client doesn't connect after relay opens

You launch Minecraft, navigate to *Servers → Add Server*, but the recorder
keeps printing `[bdt] waiting for client on …`:

- Confirm the server entry is `127.0.0.1:19150` (or whatever
  `relay.port` resolves to in your config).
- Confirm BDS is actually up — `[bdt] launching BDS …` must be followed by
  BDS's own `Server started` log line.
- Firewall? `127.0.0.1` rarely needs unblocking but check if you've added
  custom rules.

## Recording / pre-fixture

### `[ERROR] No targets matched selector` after `op @a`

The op fired before the player was fully spawned. v5 fixes this by waiting
for the BDS log line `Player Spawned` (not the bedrock-protocol `connect`
event) before sending `op @a`. If you still see it, the wait isn't kicking
in — make sure you're running the latest CLI build (`npm run build`).

### `insufficient permissions for selector expansion` in the client

The player isn't op. Most often: the smoke fixture is running but `${PLAYER}`
isn't being substituted (so commands target a literal placeholder), or
`op @a` didn't reach BDS stdin.

- Confirm `[2026-…] Opped: <name>` appears in the recorder output.
- Confirm `ctx.vars.PLAYER` is set in `record.ts` (defaults to `'@s'`).
- For per-recorder debugging: `bdt config show` to verify
  `relay.username` matches the player BDS spawns.

## Recording / mid-fixture

### Hangs forever in `waitUntilTeleportHandled`

The teleport handshake (`handled_teleport=true → false` PAI transition)
fires *during* the teleport command. If the listener attaches after that,
it misses the event and waits forever.

**Fix:** use `waitFor('player_auth_input', 8)` for setup-time teleports
(deterministic and forward-looking). `resetAndTeleport()` already does this
via `waitForTeleport: true → waitFor 8 ticks`. Reserve
`waitUntilTeleportHandled` for *inside* the test case after a teleport
that the player will then move from.

### Hangs forever in `waitUntilChunksLoaded`

BDS sends `network_chunk_publisher_update` roughly every PAI tick — if you
add it to your silence detector, silence is never reached. v5 deliberately
excludes it; only `subchunk` and `level_chunk` (the actual chunk-data
packets) count. The chunk-load wait also has a 60s hard ceiling that
logs `Chunk silence not reached within 60000ms` and rejects.

### `waitFor('player_auth_input', N) timed out after 15000ms — saw M/N events`

The client stopped sending PAI for 15s. Causes:

- **The Minecraft window lost focus.** Native input gates on the foreground
  filter (default `"Minecraft"` in the window title). Verify the window is
  still up and active.
- **The client crashed.** Look in the recorder output for
  `Player disconnected: <login>`. If yes, that fires `connection.done`
  which aborts the AbortController — the fixture rejects with
  `Sequence aborted via signal`, finally block runs cleanup.
- **The server hung.** Less common; look at BDS stdout.

### Test case advances but inputs don't reach Minecraft

The foreground gate is rejecting `SendInput` calls. Defaults to requiring
`"Minecraft"` in the window title. Alt-tabbing out of Minecraft causes
inputs to silently no-op (return 0 from `SendInput`). The recording will
*look* like it's running but the player won't move.

**Mitigation:** keep the Minecraft window focused for the duration of the
run. Once you see `[bdt] client connected` followed by `[bdt] sequence
1/…`, the recorder is driving inputs — alt-tabbing breaks them.

For headless / no-foreground use cases, call `InputController.setForegroundFilter(null)`
to disable the gate. The current CLI doesn't expose this — open an issue
or pass it through manually in `record.ts`.

## Cleanup

### Cleanup didn't run; BDS still listening on 19190

The fixture hung in a wait whose 15s timeout didn't fire (e.g. an external
infinite loop, or `sleep(Infinity)` somewhere). The relay disconnect would
normally abort, but only if the client disconnects.

**Manual cleanup:**
```pwsh
taskkill /F /IM bedrock_server.exe
taskkill /F /IM Minecraft.Windows.exe
```

Then look in the recorder output for the *last* event that fired — that's
the action that hung.

### Multiple BDS processes after several runs

Either the previous run didn't reach its finally block, or `--keep-server`
was passed. Find them with `tasklist /FI "IMAGENAME eq bedrock_server.exe"`
and `taskkill /F /PID <pid>`.

## Extraction (downstream)

### `Cannot read properties of null (reading 'protocol')`

v2's `extract-physics-fixtures.ts` uses `minecraft-data('bedrock_<version>')`
which returns null for unknown versions. v2's `minecraft-data` ships with
older-style protocol names (`26.10`, not `1.26.10`).

```pwsh
# Wrong
npx tsx scripts/extract-physics-fixtures.ts dump.proxy.bin out/ 1.26.10

# Right
npx tsx scripts/extract-physics-fixtures.ts dump.proxy.bin out/ 26.10
```

### Extractor wrote 0 test files

Either:

- The dump was recorded with an old v5 build that wrote flat L-records
  (pre-envelope fix). Re-record with the current build — L-records now
  use v2's `{message, data: ...}` envelope.
- The L-records aren't bracketing anything. `bdt list-fixtures` your fixture
  — make sure it actually has `testCase(...)` calls (not just bare actions).

### Extractor reports all cases as preload-skipped

Check that `TestCaseOptions.preload` isn't set to `true` on test cases that
should be recorded. Setup blocks should use `preamble()` (separate L-record
types) or be outside any `testCase(...)` call.

## Build / test

### `error TS1470: 'import.meta' meta-property is not allowed in files which will build into CommonJS output`

`@bdt/native-input` compiles to CommonJS. Use `require()` via
`path.join(__dirname, ...)`, not `new URL(import.meta.url)`.

### `node:test` "Unable to deserialize cloned data due to invalid or unsupported version"

The Node test runner's child-process IPC chokes on BigInt (or some other
non-clonable value) being serialized between test files. Workaround in
v5: every `npm test` script passes `--test-isolation=none` to run all
tests in one process, sidestepping the IPC entirely.

### Native addon won't compile

Required:
- Visual Studio Build Tools with the C++ workload
- Python (for node-gyp)
- Node 22+

`npm install` runs `node-gyp rebuild` automatically. If it fails, run the
build in isolation to see node-gyp's full output:

```pwsh
cd packages/native-input
npm run build:native
```
