# Architecture

bedrock-tools-v5 is a 5-package npm-workspaces monorepo. Packages are split
by *change rate* — `native-input` is stable, `bds-adapter` moves with the
bedrock-protocol version, `scenarios` churns every time someone adds a
fixture. Splitting along these axes means a protocol bump touches one
package, not all of them.

## Package map

```
┌───────────────────────────────────────────────────────────────────────┐
│                          @bdt/cli                                     │
│   `bdt` binary. Commander-based. Loads config, orchestrates BDS,      │
│   the relay, the input controller, and fixture execution.             │
└─────┬──────────────────┬────────────────────┬────────────────────────┘
      │                  │                    │
      ▼                  ▼                    ▼
┌───────────────┐  ┌─────────────────┐  ┌──────────────────────────┐
│ @bdt/scenarios│  │ @bdt/bds-adapter│  │ @bdt/native-input        │
│ DSL + fixtures│  │ Relay + BDS +   │  │ C++ N-API: SendInput,    │
│ + overlays    │  │ dump writer/    │  │ foreground filter.       │
│               │  │ reader + config │  │ TS shell: InputController│
└───────┬───────┘  └─────────┬───────┘  └──────────────────────────┘
        │                    │
        └───────────┬────────┘
                    ▼
            ┌───────────────┐
            │  @bdt/core    │
            │  Shared types │
            │  (zero deps)  │
            └───────────────┘
```

| Package | Role | Key files |
|---|---|---|
| `@bdt/core`         | Shared types only — `Fixture`, `SimulationSequence`, `SimulationAction`, `LogRecord`, `ExecutionContext`. Zero runtime deps. | `src/scenario.ts`, `src/dump-format.ts`, `src/execution-context.ts` |
| `@bdt/native-input` | C++ N-API addon wrapping Win32 `SendInput`. Typed `InputController` shell, `Keys` map, foreground-window filter. | `src/input.cpp`, `ts/index.ts`, `ts/keys.ts` |
| `@bdt/scenarios`    | The `SimulationBuilder` DSL, executor, primitive registry, JSON overlay schema + expander, fixture registry, ported v2 fixtures. | `src/builder.ts`, `src/executor.ts`, `src/overlay/*.ts`, `src/fixtures/*.ts` |
| `@bdt/bds-adapter`  | `bedrock-protocol` Relay bridge, BDS launcher, `PacketDumpWriter`/`PacketDumpReader`, config schema. | `src/relay-bridge.ts`, `src/bds-launcher.ts`, `src/dump-*.ts`, `src/config.ts` |
| `@bdt/cli`          | `bdt` binary. Thin orchestrator over the four above. | `src/cli.ts`, `src/commands/*.ts` |

Import graph is strictly acyclic: `cli → scenarios, bds-adapter, native-input, core`. `bds-adapter → native-input, core`. `scenarios → core` (no native dep — fixtures are testable headlessly).

## Data flow — a single `bdt record` invocation

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. CLI parses args, loads bdt.config.json (cwd-walk)             │
│ 2. resolveVersionConfig + assertSupported (probes                │
│    bedrock-protocol/data/versions.json)                           │
│ 3. launchBds() — copies templateWorldPath → BDS world dir,        │
│    writes server.properties, spawns BDS, waits for "Server        │
│    started"                                                       │
│ 4. (per fixture)                                                  │
│     a. RelayBridge.start() — opens relay listener on 19150        │
│     b. Prompt user to connect from Minecraft Servers tab          │
│     c. Wait for bedrock-protocol `connect` event                  │
│     d. Wait for BDS log "Player Spawned"                          │
│     e. waitForChunkSilence (clientbound subchunk + level_chunk    │
│        silence for 2s — 60s ceiling)                              │
│     f. bds.sendCommand('op @a'), 1.5s settle                      │
│     g. runFixture():                                              │
│        - writes 'fixture' L-record                                │
│        - for each sequence:                                        │
│          - if fixture.beforeEachCase set, transforms action       │
│            stream to inject preamble before each testCaseStart    │
│          - seq.execute(ctx) → executor.executeSequence()           │
│            - for…of await over the action stream                  │
│            - keyDown/keyUp/mouseMove → InputController             │
│            - command/teleport → ${PLAYER} substitution +           │
│              player.upstream.queue('command_request', …)           │
│            - waitFor/waitUntil/waitUntilChunksLoaded → listen      │
│              on events / player; 15s hard timeout                 │
│        - all packets (S/C) and L-records → PacketDumpWriter       │
│ 5. relay.close(), bds.stop(), killMinecraftClient()                │
│ 6. .proxy.bin is the artifact; extractor consumes it              │
└──────────────────────────────────────────────────────────────────┘
```

## Dump format (`.proxy.bin`)

Default (v5):

```
"BDT5\x00"   5 bytes   magic
uint32_le    1         schemaVersion
uint64_le    epochNs   wall-clock anchor (writer ctor time)
cstring      version   client version (e.g. "1.26.13.1")
record*                stream of S/C/L records
```

`--legacy` mode omits the 17-byte BDT5 header so the file is byte-compatible
with v2's `extract-physics-fixtures.ts` (which expects the version string at
offset 0). Use `--legacy` until the prismarine-bedrock extractor learns the
new header.

**Record** (`csbinary`):

```
char         'S' | 'C' | 'L'
int64_le     ns since writer ctor (relative)
S/C: int32_le length; bytes[length] payload    (raw bedrock-protocol packet)
L:   string  JSON envelope { message, data: LogRecord }
```

L-records always use v2's `{message, data}` envelope so both v2 tooling and
the v5 reader work unchanged. See `@bdt/core/src/dump-format.ts` for the
`LogRecord` union.

## Native addon (`@bdt/native-input`)

| C++ export | Purpose |
|---|---|
| `sendInput(inputs[], count)` | Forwards to Win32 `SendInput`. Gated on the foreground filter substring. |
| `getForegroundWindowTitle()` | Diagnostic. |
| `setForegroundFilter(substring \| null)` | Configurable; default `"Minecraft"`. `null` disables the gate. |

The TypeScript shell (`ts/index.ts`) builds `INPUT` structs and exposes
typed `keyDown/keyUp/mouseMove/mouseClick/mouseWheel` on `InputController`,
plus a `Keys` map (`Keys.w === 0x57`, etc.).

## Key design decisions

| Decision | Why |
|---|---|
| **Node.js + native C++ (N-API), not C#** | Single-language stack, no .NET runtime, the v2 ecosystem (bedrock-protocol, minecraft-bedrock-server, csbinary) is Node. |
| **bedrock-protocol Relay (not native client)** | The bedrock-protocol relay does the heavy crypto/serialization lifting; we just observe packets and substitute commands. |
| **for…of await executor (not v2's sync-recursive)** | Cancellation, hooks, error propagation, per-action timeouts. v2's executor swallowed errors and couldn't be aborted. |
| **`${PLAYER}` substitution → `@s`** | Recordings portable across Microsoft accounts. v2 hardcoded a personal gamertag. |
| **`waitFor('player_auth_input', N)` post-teleport, not `waitUntilTeleportHandled`** | The handshake (`handled_teleport=true/false` PAI transition) fires during the teleport command; if the listener attaches afterwards, it misses the event and hangs forever. A deterministic PAI count works regardless. |
| **`network_chunk_publisher_update` excluded from chunk silence** | BDS sends this packet every PAI tick — it would prevent silence from ever being reached. Only `subchunk` / `level_chunk` indicate actual chunk-data activity. |
| **15s timeout on every executor wait** | "Stand still and wait forever" is never the right answer. 15s is generous (PAI fires ~25/sec); anything longer is a real bug. |
| **Relay disconnect aborts the fixture** | If the client closes its window mid-recording, the fixture rejects and the finally block runs cleanup. No more zombie BDS + Minecraft processes. |
| **`op @a` post-spawn, not post-connect** | The relay `connect` event fires before BDS has spawned the player; `op @a` then sees no targets. Wait for the BDS log line `Player Spawned`. |
| **Build-once template world** | `shared_world_setup` materializes 29 scenes via `/fill`+`/setblock`, then `snapshot-world` copies the BDS world dir to a template path. Every future recording starts from the same blocks. |
| **Five packages, not one** | Each package has its own change rate. A bedrock-protocol bump touches `bds-adapter`. A new fixture touches `scenarios`. The native input layer almost never changes. |
